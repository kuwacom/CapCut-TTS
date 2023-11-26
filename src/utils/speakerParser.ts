export default function speakerParser(type: number) {
    let speaker: string;
    
    if (type === 0) {
        // 謎1 男子1
        speaker = "BV525_streaming";
    } else if (type === 1) {
        // 謎2 坊や
        speaker = "BV528_streaming";
    } else if (type === 2) {
        // カワボ
        speaker = "BV017_streaming";
    } else if (type === 3) {
        // お姉さん
        speaker = "BV016_streaming";
    } else if (type === 4) {
        // 少女
        speaker = "BV023_streaming";
    } else if (type === 5) {
        // 女子
        speaker = "BV024_streaming";
    } else if (type === 6) {
        // 男子2
        speaker = "BV018_streaming";
    } else if (type === 7) {
        // 坊ちゃん
        speaker = "BV523_streaming";
    } else if (type === 8) {
        // 女子"
        speaker = "BV521_streaming";
    } else if (type === 9) {
        // 女子アナ
        speaker = "BV522_streaming";
    } else if (type === 10) {
        // 男性アナ
        speaker = "BV524_streaming";
    } else if (type === 11) {
        // 元気ロリ
        speaker = "BV520_streaming";
    } else if (type === 12) {
        // 明るいハニー
        speaker = "VOV401_bytesing3_kangkangwuqu";
    } else if (type === 13) {
        // 優しいレディー
        speaker = "VOV402_bytesing3_oh";
    } else if (type === 14) {
        // 風雅メゾソプラノ
        speaker = "VOV402_bytesing3_aidelizan";
    } else if (type === 15) {
        // Sakura
        speaker = "jp_005";
    } else {
        // お姉さん
        speaker = "BV016_streaming";
    }
    return speaker;
} 