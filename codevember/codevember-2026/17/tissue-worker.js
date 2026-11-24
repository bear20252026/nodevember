import { generateTissueData } from './tissue-data.js';

const {data}=generateTissueData();
self.postMessage(data,[data.buffer]);
