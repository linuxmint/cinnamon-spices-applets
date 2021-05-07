export function limitString(text: string) {

    const MAX_LENGTH = 40

    if (text.length <= MAX_LENGTH) return text

    return [...text].slice(0, MAX_LENGTH - 3).join('') + '...'

}