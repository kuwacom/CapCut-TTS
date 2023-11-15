export type SynthesizePayload = {
    text: string;
    speaker: string;
    pitch: number;
    speed: number;
    volume: number;
    rate: number;
    appid: string;
}

export type Synthesize = {
    token: string;
    appkey: string;
    namespace: string
    event: string;
    payload: string;
}

export type TaskStatus = {
    task_id: string;
    message_id: string;
    namespace: string;
    event: string;
    status_code: number;
    status_text: string;
};