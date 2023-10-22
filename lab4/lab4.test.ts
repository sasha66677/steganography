import Jimp from 'jimp'
import {TextDecoder} from 'util'
import fs from "fs"
import {imageLSBExtract, imageBlockExtract} from '../lab2/lab2'
import {kjbExtract} from '../lab3/lab3'
import {imageLSBExtractVertical} from "./lab4";

jest.setTimeout(30000);

describe('lab4', () => {

    it('LSB vertical', async () => {
        const container = await Jimp.read('lab4/kb-5/container2.bmp');
        const extractedMessageAsUtf8 = imageLSBExtractVertical(container, 10000);
        const textDecoder = new TextDecoder();
        const decodedExtractedMessage = textDecoder.decode(extractedMessageAsUtf8);
        fs.writeFileSync('lab4/kb-5/perbit2_1.txt', decodedExtractedMessage, 'utf-8');

        /*
        * The decoded string is: "This is a secret message that needs to be decoded using Base64"
        * */
    });

    it('LSB Block', async () => {
        let messageLength = 10000;
        {
            const container = await Jimp.read('lab4/kb-5/container1.bmp');
            const extractedMessageAsUtf8 = imageLSBExtract(container, messageLength);
            const textDecoder = new TextDecoder();
            const decodedExtractedMessage = textDecoder.decode(extractedMessageAsUtf8);
            fs.writeFileSync('lab4/kb-5/perbit1.txt', decodedExtractedMessage, 'utf-8');
        }

        {
            const container = await Jimp.read('lab4/kb-5/container3.png');////////////////////////////////////////////////////////////////
            const extractedMessageAsUtf8 = imageLSBExtract(container, messageLength);
            const textDecoder = new TextDecoder();
            const decodedExtractedMessage = textDecoder.decode(extractedMessageAsUtf8);
            fs.writeFileSync('lab4/kb-5/perbit3.txt', decodedExtractedMessage, 'utf-8');
        }
    });

    it('4', async () => {
        const config = {width: 3, height: 3};
        const container = await Jimp.read('lab4/kb-5/container4.jpg');
        const ex = imageBlockExtract(container, config, 15000);
        const textDecoder = new TextDecoder();
        const dec = textDecoder.decode(ex);
        fs.writeFileSync('lab4/kb-5/perBlock4.txt', dec, 'utf-8');
        /*nothing*/
    });

    it('LSB Block', async () => {
        const config = {width: 14, height: 9};
        const container = await Jimp.read('lab4/kb-5/container5.png');
        const ex = imageBlockExtract(container, config, 15000);
        const textDecoder = new TextDecoder();
        const dec = textDecoder.decode(ex);
        fs.writeFileSync('lab4/kb-5/perBlock5.txt', dec, 'utf-8');
        /*
        *	Вродё!бы!что.то!и!извлёклось-!а!вродё!бы!и!нёт@!Тогда!надо!смотрёть!на!статистичёскоё!распрёдёлёниё!символов!в!тёкстё-!потому!что!многиё!шифры!.!в!том!числё!и!шифр!Цёзарѐ-!который!тут!использовалсѐ!.!сохранѐют!статистичёскоё!распрёдёлёниё/!Подсказка!.!ключ!к!шифртёксту!можно!получить!мётодом!LKC!с!длиной!сообщёниѐ!8!символов!и!кратностью!встраиваниѐ!10
        * */
    });


    it('6', async () => {
        const container = await Jimp.read('lab4/kb-5/container6.jpg');
        const ex = kjbExtract(container, 8, {multiplicity: 10});
        const textDecoder = new TextDecoder();
        const dec = textDecoder.decode(ex);
        fs.writeFileSync('lab4/kb-5/perKJB6.txt', dec, 'utf-8');
        /*nothing*/
    });

    it('KJB', async () => {
        const container = await Jimp.read('lab4/kb-5/container7.png');
        const ex = kjbExtract(container, 8, {multiplicity: 10});
        const textDecoder = new TextDecoder();
        const dec = textDecoder.decode(ex);
        fs.writeFileSync('lab4/kb-5/perKJB7.txt', dec, 'utf-8');
        /*nothing*/
    });

    it('9', async () => {
        let messageLength = 10000;
        const container = await Jimp.read('lab4/kb-5/container9.bmp');
        const extractedMessageAsUtf8 = imageLSBExtract(container, messageLength);
        const textDecoder = new TextDecoder();
        const decodedExtractedMessage = textDecoder.decode(extractedMessageAsUtf8);
        fs.writeFileSync('lab4/kb-5/perbit9.txt', decodedExtractedMessage, 'utf-8');
    });

})
