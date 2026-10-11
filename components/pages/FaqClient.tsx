'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { mediaUrl } from '@/lib/media-url';

export type FaqClientCategory = {
  id: number;
  name: string;
  image_path: string | null;
  image_alt: string | null;
};

export type FaqClientItem = {
  question: string;
  answer: string;
  category_id: number | null;
};

export default function FaqClient({
  title,
  subtitle,
  categories,
  items,
}: {
  title: string;
  subtitle: string;
  categories: FaqClientCategory[];
  items: FaqClientItem[];
}) {
  const [query, setQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [openQuestion, setOpenQuestion] = useState<string | null>(items[0]?.question ?? null);
  const normalizedQuery = query.trim().toLocaleLowerCase();

  const categorySuggestions = useMemo(() => {
    if (!normalizedQuery) return [];
    return categories
      .filter((category) => category.name.toLocaleLowerCase().includes(normalizedQuery))
      .slice(0, 5);
  }, [categories, normalizedQuery]);

  const questionSuggestions = useMemo(() => {
    if (!normalizedQuery || categorySuggestions.length) return [];
    return items
      .filter((item) => item.question.toLocaleLowerCase().includes(normalizedQuery))
      .slice(0, 6);
  }, [categorySuggestions.length, items, normalizedQuery]);

  const categoryQuestionSuggestions = useMemo(() => {
    if (!categorySuggestions.length) return [];
    const categoryIds = new Set(categorySuggestions.map((category) => category.id));
    return items.filter((item) => item.category_id !== null && categoryIds.has(item.category_id)).slice(0, 6);
  }, [categorySuggestions, items]);

  const filteredItems = useMemo(() => {
    const q = normalizedQuery;
    return items.filter((item) => {
      if (activeCategoryId !== null && item.category_id !== activeCategoryId) return false;
      if (!q) return true;
      if (categorySuggestions.length) {
        return categorySuggestions.some((category) => category.id === item.category_id);
      }
      return item.question.toLocaleLowerCase().includes(q);
    });
  }, [activeCategoryId, categorySuggestions, items, normalizedQuery]);

  const selectCategorySuggestion = (categoryId: number) => {
    setActiveCategoryId(categoryId);
    setQuery('');
  };

  const selectQuestionSuggestion = (item: FaqClientItem) => {
    setActiveCategoryId(item.category_id);
    setOpenQuestion(item.question);
    setQuery('');
  };

  return (
    <>
      <h1 className="text-center text-[clamp(1.5rem,2.4vw,1.875rem)] uppercase leading-none tracking-[0.04em] text-[#111111] font-bold!">
        How May We Help You?
      </h1>

      <div className="relative z-10 mx-auto mt-6 max-w-lg">
        <div className="flex items-center gap-3 border border-[#e4e4e4] bg-(--color-white) px-4 py-3">
          <Search size={16} strokeWidth={1.75} className="shrink-0 text-[#767676]" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search categories or questions"
            aria-label="Search FAQ categories or questions"
            aria-autocomplete="list"
            aria-expanded={Boolean(normalizedQuery)}
            aria-controls="faq-search-suggestions"
            className="w-full bg-transparent text-[14px] text-[#222222] outline-none placeholder:text-[#9a9a9a]"
          />
        </div>
        {normalizedQuery ? (
          <div id="faq-search-suggestions" role="listbox" aria-label={categorySuggestions.length ? 'Matching categories and related questions' : 'Matching questions'} className="absolute inset-x-0 top-full max-h-72 overflow-y-auto border border-t-0 border-[#e4e4e4] bg-white shadow-md">
            {categorySuggestions.length ? (
              <>
                {categorySuggestions.map((category) => (
                  <button key={category.id} type="button" role="option" aria-selected={false} onClick={() => selectCategorySuggestion(category.id)} className="block w-full border-0 border-b border-[#eeeeee] bg-white px-4 py-3 text-left text-[13px] text-[#222222] hover:bg-[#f7f7f7]">
                    <span className="block text-[10px] uppercase tracking-[0.08em] text-[#767676]">Category</span>
                    <span>{category.name}</span>
                  </button>
                ))}
                {categoryQuestionSuggestions.length ? <p className="border-b border-[#eeeeee] bg-[#fafafa] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-[#767676]">Related questions</p> : null}
                {categoryQuestionSuggestions.map((item) => (
                  <button key={item.question} type="button" role="option" aria-selected={false} onClick={() => selectQuestionSuggestion(item)} className="block w-full border-0 border-b border-[#eeeeee] bg-white px-4 py-3 text-left text-[13px] text-[#222222] last:border-b-0 hover:bg-[#f7f7f7]">
                    <span className="block text-[10px] uppercase tracking-[0.08em] text-[#767676]">Related question</span>
                    <span>{item.question}</span>
                  </button>
                ))}
              </>
            ) : questionSuggestions.length ? (
              questionSuggestions.map((item) => (
                <button key={item.question} type="button" role="option" aria-selected={false} onClick={() => selectQuestionSuggestion(item)} className="block w-full border-0 border-b border-[#eeeeee] bg-white px-4 py-3 text-left text-[13px] text-[#222222] last:border-b-0 hover:bg-[#f7f7f7]">
                  <span className="block text-[10px] uppercase tracking-[0.08em] text-[#767676]">Question</span>
                  <span>{item.question}</span>
                </button>
              ))
            ) : (
              <p className="px-4 py-3 text-[13px] text-[#555555]">No matching categories or questions.</p>
            )}
          </div>
        ) : null}
      </div>

      {subtitle ? (
        <p className="mt-10 text-center text-[13px] leading-[1.75] text-[#292727]">{subtitle}</p>
      ) : null}

      {categories.length ? (
        <div className="mx-auto mt-6 grid max-w-6xl grid-cols-2 gap-3 sm:grid-cols-4">
          {categories.map((category) => {
            const isSelected = activeCategoryId === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategoryId((prev) => (prev === category.id ? null : category.id))}
                aria-pressed={isSelected}
                className={
                  'flex aspect-square flex-col items-center justify-center gap-4 border bg-(--color-white) p-4 text-center transition-colors ' +
                  (isSelected ? 'border-[#767676]' : 'border-[#e4e4e4] hover:border-[#c4c4c4]')
                }
              >
                {category.image_path ? (
                  <img
                    src={mediaUrl(category.image_path)}
                    alt={category.image_alt || category.name}
                    className="h-12 w-12 object-contain"
                  />
                ) : (
                  <span className="text-[28px] font-light text-black/15" aria-hidden="true">◇</span>
                )}
                <span className="text-[12px] font-semibold uppercase leading-[1.4] tracking-[0.08em] text-[#222222]">
                  {category.name}
                </span>
                {isSelected ? <span className="text-[11px] text-[#222222] underline">view</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mx-auto mt-10 max-w-6xl border border-[#e4e4e4] bg-(--color-white) px-6 py-8 sm:px-10 sm:py-10">
        <div className="grid gap-8 lg:grid-cols-[0.3fr_0.7fr]">
          <h2 className="text-[16px] uppercase leading-[1.4] tracking-[0.06em] text-[#222222] font-bold!">
            {title || 'Frequently Asked Questions'}
          </h2>

          <div className="divide-y divide-[#e4e4e4]">
            {filteredItems.length ? (
              filteredItems.map((item) => {
                const isOpen = openQuestion === item.question;
                return (
                  <section key={item.question}>
                    <button
                      type="button"
                      onClick={() => setOpenQuestion(isOpen ? null : item.question)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-5 py-4 text-left"
                    >
                      <span className="text-[13px] font-semibold text-[#222222]">{item.question}</span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        aria-hidden="true"
                        className={
                          'shrink-0 stroke-current text-[#222222] transition-transform duration-300 ' +
                          (isOpen ? 'rotate-45' : '')
                        }
                      >
                        <path d="M6 1V11M1 6H11" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                    {isOpen ? (
                      <p className="pb-5 text-[13px] leading-[1.75] text-[#292727]">{item.answer}</p>
                    ) : null}
                  </section>
                );
              })
            ) : (
              <p className="py-4 text-[13px] leading-[1.75] text-[#292727]">No questions match your search.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
