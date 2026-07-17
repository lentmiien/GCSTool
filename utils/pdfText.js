function getFittingCharacterCount(text, font, fontSize, maxWidth) {
  let lowerBound = 0;
  let upperBound = text.length;

  while (lowerBound < upperBound) {
    const characterCount = Math.ceil((lowerBound + upperBound) / 2);
    const candidate = text.slice(0, characterCount);

    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      lowerBound = characterCount;
    } else {
      upperBound = characterCount - 1;
    }
  }

  return lowerBound;
}

function addEllipsis(line, font, fontSize, maxWidth) {
  const ellipsis = '...';
  const availableWidth = maxWidth - font.widthOfTextAtSize(ellipsis, fontSize);

  if (availableWidth < 0) {
    return '';
  }

  const characterCount = getFittingCharacterCount(line, font, fontSize, availableWidth);
  return `${line.slice(0, characterCount).trimEnd()}${ellipsis}`;
}

function wrapTextToLines(text, font, fontSize, maxWidth, maxLines) {
  const normalizedText = String(text || '').replace(/\s+/g, ' ').trim();
  const lines = [];
  let remainingText = normalizedText;

  while (remainingText && lines.length < maxLines) {
    if (font.widthOfTextAtSize(remainingText, fontSize) <= maxWidth) {
      lines.push(remainingText);
      remainingText = '';
      break;
    }

    const characterCount = getFittingCharacterCount(
      remainingText,
      font,
      fontSize,
      maxWidth,
    );

    if (characterCount === 0) {
      break;
    }

    const fittingText = remainingText.slice(0, characterCount);
    const lastSpaceIndex = fittingText.lastIndexOf(' ');
    const splitIndex = lastSpaceIndex > 0 ? lastSpaceIndex : characterCount;
    const line = remainingText.slice(0, splitIndex).trimEnd();

    lines.push(line);
    remainingText = remainingText.slice(splitIndex).trimStart();
  }

  if (remainingText && lines.length > 0) {
    const lastLineIndex = lines.length - 1;
    lines[lastLineIndex] = addEllipsis(
      lines[lastLineIndex],
      font,
      fontSize,
      maxWidth,
    );
  }

  return lines;
}

module.exports = {
  wrapTextToLines,
};
