import * as drpy from '../libs/drpyS.js';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('__dirname:', __dirname);

(async () => {
    // 使用 __dirname 来确保正确的相对路径，避免路径出错
    const modulePath = path.join(__dirname, '../js/_360.js');

    try {
        console.log('Initializing module...');
        const module = await drpy.init(modulePath); // 初始化模块

        console.log('Calling home...');
        const result1 = await drpy.home(modulePath); // 调用 home 方法

        console.log('Calling homeVod...');
        const result2 = await drpy.homeVod(modulePath); // 调用 homeVod 方法

        console.log('Calling cate...');
        const result3 = await drpy.cate(modulePath); // 调用 cate 方法

        console.log('Calling detail...');
        const result4 = await drpy.detail(modulePath); // 调用 detail 方法

        console.log('Calling search...');
        const result5 = await drpy.search(modulePath); // 调用 search 方法

        console.log('Calling play...');
        const result6 = await drpy.play(modulePath); // 调用 play 方法

        console.log('Result1:', result1);
        console.log('Result2:', result2);
        console.log('Result3:', result3);
        console.log('Result4:', result4);
        console.log('Result5:', result5);
        console.log('Result6:', result6);
    } catch (error) {
        console.error('Error during module initialization or invocation:', error);
    }
})();
