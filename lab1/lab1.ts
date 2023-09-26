import fs from 'fs'
import Jimp from 'jimp'
import zlib from "zlib";

// если .format === 'jpg', у объекта есть дополнительное числовое свойство quality
// если .format === 'png', дополнительных свойств нет
export type ConversionOptions =
    | { format: 'jpg'; quality: 99 | 90 | 75 | 50 }
    | { format: 'png' }
    | { format: 'deflate' }

export type CompressionInfo = {
    sizeBefore: number
    sizeAfter: number
    compressionRatio: number
}

export async function convert(filename: string, options: ConversionOptions): Promise<CompressionInfo> {
    const bikeBmp = await Jimp.read(filename);

    const bmpBuffer = await bikeBmp.getBufferAsync(Jimp.MIME_BMP);
    const bmpSize = bmpBuffer.byteLength;

    const compressionInfo: CompressionInfo = {
        sizeBefore: bmpSize,
        sizeAfter: 0,
        compressionRatio: 0
    };

    let sizeAfter;

    if (options.format === 'jpg') {
        const {quality} = options;
        const buffer = await bikeBmp.quality(quality).getBufferAsync(Jimp.MIME_JPEG);
        sizeAfter = buffer.byteLength;
    } else if (options.format === 'png') {
        const buffer = await bikeBmp.getBufferAsync(Jimp.MIME_PNG);
        sizeAfter = buffer.byteLength;
    } else {
        const zlib = require("zlib");
        const deflate = zlib.deflateSync(bmpBuffer);
        sizeAfter = deflate.buffer.byteLength;
    }

    compressionInfo.sizeAfter = sizeAfter;
    compressionInfo.compressionRatio = sizeAfter / bmpSize;

    return compressionInfo;

}

export async function pngAndDeflate(filename: string): Promise<CompressionInfo> {
    const bmpFile = await Jimp.read(filename);
    const bmpBuffer = await bmpFile.getBufferAsync(Jimp.MIME_BMP);
    const bmpSize = bmpBuffer.byteLength;

    const pngBuffer = await bmpFile.getBufferAsync(Jimp.MIME_PNG);
    const newSize = zlib.deflateSync(pngBuffer).buffer.byteLength;

    return {
        sizeBefore: bmpSize,
        sizeAfter: newSize,
        compressionRatio: newSize / bmpSize
    };

}
