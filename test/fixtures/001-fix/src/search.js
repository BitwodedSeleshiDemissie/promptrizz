import { books } from './books.js';
import { rank } from './rank.js';

function toTerms(query) {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

function matches(book, terms) {
  const text = `${book.title} ${book.author}`.toLowerCase();
  return terms.every((term) => text.includes(term));
}

export function search(query) {
  const terms = toTerms(query);
  if (terms.length === 0) return books;
  const found = books.filter((book) => matches(book, terms));
  return rank(found, terms);
}
