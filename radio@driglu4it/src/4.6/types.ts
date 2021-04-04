export type PlaybackStatus = "Playing" | "Paused" | "Stopped"

export interface Channel {
    name: string,
    url: string,
    inc: boolean
}