import Jimp from "jimp";
import {bitArrayToByte, ByteAsBitArray, byteToBitArray} from "../lab2/lab2";

export function imageLSBExtractVertical(container, byteLength, bitsPerImageByte = 1) {
    const byteArray: number[] = [];
    const bitArray: ByteAsBitArray = [0, 0, 0, 0, 0, 0, 0, 0];

    let bitIndex = 0;
    let byteLengthCount = 0; // counter to keep track of the extracted bytes.


    for (let column = 0; column < container.getWidth(); column+=2) {
        for (let row = 0; row < container.getHeight(); row += 2) {
            const pixelColor = Jimp.intToRGBA(container.getPixelColor(column, row));

            for (const channelName of ['r', 'g', 'b'] as const) {
                const channelByte = pixelColor[channelName];
                const channelByteAsBitArray = byteToBitArray(channelByte);

                for (let i = 7; i >= 8 - bitsPerImageByte; i--) {
                    const nextBit = channelByteAsBitArray[i];
                    bitArray[bitIndex] = nextBit;
                    bitIndex++;

                    if (bitIndex === 8) { // If a complete byte is collected, process it.
                        bitIndex = 0;
                        byteLengthCount++;
                        const byte = bitArrayToByte(bitArray);
                        byteArray.push(byte);

                        if (byteLengthCount === byteLength) {
                            return Uint8Array.from(byteArray).buffer;
                        }
                    }
                }
            }
        }
    }

    // If there are unused message bits, throw an error indicating insufficient data extraction.
    throw new Error('Failed to extract enough image bytes.');
}
