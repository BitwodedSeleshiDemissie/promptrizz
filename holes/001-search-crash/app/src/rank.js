// Books with the longest search word in their title come first, then A to Z.

function longest(terms) {
  return terms.reduce((a, b) => (b.length > a.length ? b : a));
}

export function rank(found, terms) {
  const word = longest(terms);
  const inTitle = (book) => (book.title.toLowerCase().includes(word) ? 0 : 1);
  return [...found].sort((a, b) => inTitle(a) - inTitle(b) || a.title.localeCompare(b.title));
}
