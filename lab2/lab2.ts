import Jimp from 'jimp'

/**
 * A function that allows iterating through the bits of an arbitrary buffer one bit at a time.
 */
export function* readBufferBitByBit(input: ArrayBuffer): IterableIterator<0 | 1> {
    // Convert the ArrayBuffer into a Uint8Array for easier bit manipulation.
    for (const byte of new Uint8Array(input)) {
        // Iterate through each bit in the current byte, from the most significant bit to the least significant bit.
        for (let offset = 7; offset >= 0; offset--) {
            // Create a mask with a single '1' at the current bit position.
            // The mask is shifted left by the 'offset' positions.
            const mask = 1 << offset;

            // Perform a bitwise AND operation between the current byte and the mask.
            // If the result is not equal to 0, it means the bit at the current position is set to 1.
            // If the result is 0, the bit is 0.
            if ((mask & byte) !== 0) {
                yield 1; // Yield 1 if the bit is set to 1.
            } else {
                yield 0; // Yield 0 if the bit is set to 0.
            }
        }
    }
}


export type Bit = 0 | 1
export type ByteAsBitArray = [Bit, Bit, Bit, Bit, Bit, Bit, Bit, Bit]

export function byteToBitArray(byte: number): ByteAsBitArray {
    return Array.from(readBufferBitByBit(Uint8Array.from([byte]))) as ByteAsBitArray
}

export function bitArrayToByte(bitArray: ByteAsBitArray) {
    let byte = 0
    for (let offset = 7; offset >= 0; offset--) {
        const bitIndex = 7 - offset
        const bit = bitArray[bitIndex]
        const mask = 1 << offset
        if (bit) {
            byte |= mask
        }
    }
    return byte
}

export type LSBBitsPerImageByte = 1 | 2 | 3 | 4 | 5 | 6 | 7


export function imageLSBEmbed(container: Jimp, message: ArrayBuffer,
                              bitsPerImageByte: LSBBitsPerImageByte = 1): Jimp {
    const modifiedContainer = container.clone();
    const messageBitIterator = readBufferBitByBit(message);

    main_loop:
        for (let row = 0; row < modifiedContainer.getHeight(); row++) {
            for (let column = 0; column < modifiedContainer.getWidth(); column++) {
                const pixelColor = Jimp.intToRGBA(container.getPixelColor(column, row));
                let lastIteratorResult: IteratorResult<Bit> = {value: 0, done: false}; // Initialize the message bit iterator.

                for (const channelName of ['r', 'g', 'b'] as const) { // Iterate through color channels (red, green, blue).
                    const channelByte = pixelColor[channelName];
                    const channelByteAsBitArray = byteToBitArray(channelByte);

                    for (let i = 7; i >= 8 - bitsPerImageByte; i--) { // Iterate through the selected LSBs of the byte.
                        if (!lastIteratorResult.done) { // Check if there are more message bits to embed.
                            lastIteratorResult = messageBitIterator.next();
                            channelByteAsBitArray[i] = lastIteratorResult.value;
                        } else {
                            break;
                        }
                    }

                    pixelColor[channelName] = bitArrayToByte(channelByteAsBitArray); // Update the color channel with the modified byte value.
                }

                const modifiedColor = Jimp.rgbaToInt(pixelColor.r, pixelColor.g, pixelColor.b, pixelColor.a);
                modifiedContainer.setPixelColor(modifiedColor, column, row);

                if (lastIteratorResult.done) {
                    break main_loop;
                }
            }
        }

    if (!messageBitIterator.next().done) {
        throw new Error('The message is too large to be embedded in this container');
    }

    return modifiedContainer;
}


export function imageLSBExtract(container, byteLength, bitsPerImageByte = 1) {
    const byteArray: number[] = [];
    const bitArray: ByteAsBitArray = [0, 0, 0, 0, 0, 0, 0, 0];

    let bitIndex = 0;
    let byteLengthCount = 0; // counter to keep track of the extracted bytes.

    for (let row = 0; row < container.getHeight(); row++) {
        for (let column = 0; column < container.getWidth(); column++) {
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

// Embeds a message into an image block by block
export function imageBlockEmbed(container: Jimp, message: ArrayBuffer, blockSize: { width: number; height: number }): Jimp {
  // Clone the original container to avoid modifying it directly
  const modifiedContainer = container.clone();
  const messageBitIterator = readBufferBitByBit(message);

  for (let row = 0; row < container.getHeight(); row += blockSize.height) {
    for (let column = 0; column < container.getWidth(); column += blockSize.width) {
      // Skip incomplete blocks that exceed the image dimensions
      if (row + blockSize.height >= container.getHeight() || column + blockSize.width >= container.getWidth()) {
        continue;
      }

      // Calculate the XORed byte for each block
      let xoredByte = 0;
      for (let x = column; x < column + blockSize.width; x++) {
        for (let y = row; y < row + blockSize.height; y++) {
          const color = Jimp.intToRGBA(container.getPixelColor(x, y));
          for (const component of ['r', 'g', 'b'] as const) {
            xoredByte ^= color[component];
          }
        }
      }

      // Calculate the parity bit for the XORed byte
      let parityBit = 0;
      for (const bit of byteToBitArray(xoredByte)) {
        parityBit ^= bit;
      }

      // Check if the message embedding is complete
      const iteratorResult = messageBitIterator.next();
      if (iteratorResult.done) {
        return modifiedContainer; // Message fully embedded
      }

      const nextBit = iteratorResult.value;

      // Modify the least significant bit if the parity bit doesn't match the message bit
      if (parityBit !== nextBit) {
        const x = Math.floor(Math.random() * blockSize.width) + column;
        const y = Math.floor(Math.random() * blockSize.height) + row;

        const pixelColor = Jimp.intToRGBA(container.getPixelColor(x, y));
        pixelColor.b = pixelColor.b ^ 1; // Toggle the least significant bit
        const modifiedColor = Jimp.rgbaToInt(pixelColor.r, pixelColor.g, pixelColor.b, pixelColor.a);
        modifiedContainer.setPixelColor(modifiedColor, x, y);
      }
    }
  }

  // Check if the message exceeds the container size
  if (!messageBitIterator.next().done) {
    throw new Error('Message is too large to be embedded in this container');
  }

  return modifiedContainer;
}

// Extracts a message from an image block by block
export function imageBlockExtract(container: Jimp, blockSize: { width: number; height: number }, length: number): ArrayBuffer {
  const byteArray: number[] = [];
  const modifiedContainer = container.clone();
  let byteCount = 0;
  let bitCount = 0;
  const bitArray: ByteAsBitArray = [0, 0, 0, 0, 0, 0, 0, 0];

  for (let row = 0; row < container.getHeight(); row += blockSize.height) {
    for (let column = 0; column < container.getWidth(); column += blockSize.width) {
      // Skip incomplete blocks that exceed the image dimensions
      if (row + blockSize.height >= container.getHeight() || column + blockSize.width >= container.getWidth()) {
        continue;
      }

      // Calculate the XORed byte for each block
      let xoredByte = 0;
      for (let x = column; x < column + blockSize.width; x++) {
        for (let y = row; y < row + blockSize.height; y++) {
          const color = Jimp.intToRGBA(container.getPixelColor(x, y));
          for (const component of ['r', 'g', 'b'] as const) {
            xoredByte ^= color[component];
          }
        }
      }

      // Calculate the parity bit for the XORed byte
      let parityBit = 0;
      for (const bit of byteToBitArray(xoredByte)) {
        parityBit ^= bit;
      }

      bitArray[bitCount] = <Bit>parityBit;

      bitCount++;
      if (bitCount === 8) {
        bitCount = 0;
        byteCount++;
        const byte = bitArrayToByte(bitArray);
        byteArray.push(byte);
      }

      // Check if the extracted message length matches the specified length
      if (byteCount === length) {
        return new Uint8Array(byteArray).buffer;
      }
    }
  }

  return new Uint8Array(byteArray).buffer;
}