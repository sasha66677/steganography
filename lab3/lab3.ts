import Jimp from 'jimp'
import {readBufferBitByBit, byteToBitArray, bitArrayToByte, ByteAsBitArray} from '../lab2/lab2'

type KJBOptions = {
    /** Мощность встраивания - коэффициент пропорциональности модификации синей компоненты */
    lambda: number
    /** Количество пикселей на кресте, в оригинальном алгоритме используется 2 */
    crossPixelCount: number
    /**
     * Т.к. извлечение носит вероятностный характер, для сообщения рекомендуется использовать
     * помехоустойчивое кодирование; чтобы не заморачиваться с реализацией кодирования по Хэммингу,
     * можно просто сообщение продублировать несколько раз и для каждого бита выбрать медиану.
     */
    multiplicity: number
}

function* duplicate<T>(container: Iterable<T>, times: number): IterableIterator<T> {
    for (let i = 0; i < times; i++) {
        yield* container
    }
}

/**
 * Вспомогательная функция для реализации многократного встраивания. По переданному сообщению message
 * возвращает буфер, содержащий это же сообщение, продублированное multiplicity раз.
 */
export function multiply(message: ArrayBuffer, multiplicity: number) {
    return new Uint8Array(duplicate(new Uint8Array(message), multiplicity))
}

/**
 * Вспомогательная функция для реализации извлечения по многократному встраиванию. По переданному буферу
 * message и кратности multiplicity возвращает буфер длиной message.length / multiplicity, в котором
 * каждый бит сообщения выбирается усреднением соответствующих бит в многократно продублированном сообщении.
 */
export function demultiply(message: Uint8Array, multiplicity: number) {
    const byteLength = message.length / multiplicity
    const bitLength = byteLength * 8
    const bitCountArray: (0 | 1)[] = []
    let bitIndex = 0

    for (const bit of readBufferBitByBit(message)) {
        const messageBitIndex = bitIndex % bitLength
        if (typeof bitCountArray[messageBitIndex] !== 'number') {
            bitCountArray[messageBitIndex] = 0
        }

        if (bit) {
            bitCountArray[messageBitIndex]++
        }

        bitIndex++
    }

    const byteArray: number[] = []
    for (let byteIndex = 0; byteIndex < byteLength; byteIndex++) {
        const offset = byteIndex * 8
        const slice = bitCountArray.slice(offset, offset + 8)
        const bitArray = slice.map(bitCount => Math.round(bitCount / multiplicity)) as ByteAsBitArray
        byteArray.push(bitArrayToByte(bitArray))
    }

    return Uint8Array.from(byteArray)
}

/**
 * This code is used to embed a message into an image.
 * It iterates over the pixels of the image, calculates the Y channel value for luminance,
 * and modifies the blue component of the pixel based on the message bit and lambda value.
 * The modified image with the embedded message is returned.
 */
export function kjbEmbed(
    container: Jimp,
    message: ArrayBuffer,
    {lambda = 0.1, crossPixelCount = 2, multiplicity = 1}: Partial<KJBOptions> = {}
) {
    const modifiedContainer = container.clone();

    // Creating an iterator to read the message bits
    const messageBitIterator = readBufferBitByBit(multiply(message, multiplicity));

    const containerWidth = modifiedContainer.getWidth();
    const containerHeight = modifiedContainer.getHeight();

    for (let row = crossPixelCount; row < containerHeight - crossPixelCount; row += crossPixelCount) {
        for (let column = crossPixelCount; column < containerWidth - crossPixelCount; column += crossPixelCount) {
            // Checking if all message bits have been embedded
            const {value, done} = messageBitIterator.next();
            if (done) {
                return modifiedContainer; // Return the modified container if all message bits have been embedded
            }

            // Extracting the RGBA values of the pixel
            const {r, g, b, a} = Jimp.intToRGBA(container.getPixelColor(column, row));

            // Calculating the Y channel value for luminance
            const Yxy = 0.299 * r + 0.587 * g + 0.114 * b;

            // Calculating the modification based on the message bit and lambda
            let diff = lambda * Yxy;
            let modifiedBTemp = value === 1 ? Math.ceil(b + diff) : Math.floor(b - diff);

            // Ensuring that the modified blue component stays within the valid range [0, 255]
            let modifiedB = Math.max(0, Math.min(modifiedBTemp, 255));

            // Updating the pixel with the modified blue component
            modifiedContainer.setPixelColor(Jimp.rgbaToInt(r, g, modifiedB, a), column, row);
        }
    }

    return modifiedContainer; // Return the modified container with the embedded message
}


export function kjbExtract(
    container: Jimp,
    byteLength: number,
    {crossPixelCount = 2, multiplicity = 1}: Partial<KJBOptions> = {}
) {
    const byteArray: number[] = []; // array to store extracted bytes.
    let currentByte = 0;
    let currentByteBitOffset = 7;

    for (let row = crossPixelCount; row < container.getHeight() - crossPixelCount; row += crossPixelCount) {
        for (let column = crossPixelCount; column < container.getWidth() - crossPixelCount; column += crossPixelCount) {
            // Extract blue value from the pixel.
            const {b: blueActual} = Jimp.intToRGBA(container.getPixelColor(column, row));
            let estimation = 0;

            // Loop to calculate the estimated blue value using neighboring pixels.
            for (let sigmaCount = 1; sigmaCount <= crossPixelCount; sigmaCount++) {
                estimation += Jimp.intToRGBA(container.getPixelColor(column, row + sigmaCount)).b +
                    Jimp.intToRGBA(container.getPixelColor(column + sigmaCount, row)).b +
                    Jimp.intToRGBA(container.getPixelColor(column - sigmaCount, row)).b +
                    Jimp.intToRGBA(container.getPixelColor(column, row - sigmaCount)).b;
            }

            let blueEstimated = estimation / (4 * crossPixelCount); // Calculate the estimated blue value.

            const estimatedBit = blueActual > blueEstimated ? 1 : 0; // Determine the estimated bit (1 or 0).

            const mask = estimatedBit << currentByteBitOffset; // Create a mask to set the bit in the current byte.
            currentByte |= mask; // Set the estimated bit in the current byte.

            if (currentByteBitOffset === 0) {
                byteArray.push(currentByte); // Add the completed byte to the array.
                currentByteBitOffset = 7; // Reset the bit offset.
                currentByte = 0; // Reset the current byte.

                // Check if enough bytes have been extracted, and demultiply them if necessary.
                if (byteArray.length === byteLength * multiplicity) {
                    return demultiply(Uint8Array.from(byteArray), multiplicity);
                }
            } else {
                currentByteBitOffset--; // Decrement the bit offset.
            }
        }
    }

    return Uint8Array.from(byteArray);
}




