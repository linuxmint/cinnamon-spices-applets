
export function limitString(text: string, maxCharNumber: number) {

    if (!text) return

    if (text.length <= maxCharNumber) return text

    return [...text].slice(0, maxCharNumber - 3).join('') + '...'

}
