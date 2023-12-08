
export function limitString(text: string, maxCharNumber: number): string {

    if (text.length <= maxCharNumber) return text

    return [...text].slice(0, maxCharNumber - 3).join('') + '...'

}
