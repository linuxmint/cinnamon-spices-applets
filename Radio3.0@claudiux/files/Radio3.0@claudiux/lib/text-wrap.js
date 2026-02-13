// Text wrapper
const formatTextWrap = (text, maxLineLength) => {
  const words = text.replace(/[\r\n]+/g, " ").split(" ");
  let lineLength = 0;

  // use functional reduce, instead of for loop
  return words.reduce((result, word) => {
    if (lineLength + word.length >= maxLineLength) {
      lineLength = word.length;
      return result + `\n${word}`; // don't add spaces upfront
    } else {
      lineLength += word.length + (result ? 1 : 0);
      return result ? result + ` ${word}` : `${word}`; // add space only when needed
    }
  }, "");
}
