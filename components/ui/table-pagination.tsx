"use client";

/**
 * Pagination d'un tableau.
 *
 * Le catalogue des matières compte 162 lignes et les empilait toutes : la
 * colonne la plus large — le nom — est aussi la moins discriminante, « Arts »
 * revenant huit fois de suite pour huit classes. Paginer ne remplace pas la
 * recherche, mais rend le balayage possible quand on ne sait pas encore quoi
 * chercher.
 *
 * La page courante est passée **déjà bornée** par l'appelant : l'état ne
 * conserve jamais une page hors plage, ce qui évite d'avoir à la corriger dans
 * un effet après coup.
 */
function Pagination({
  page,
  pageCount,
  onPageChange,
  rangeStart,
  rangeEnd,
  total,
  label,
  unit,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  label: string;
  unit: string;
}) {
  if (pageCount <= 1) return null;

  // Fenêtre glissante : première, dernière, et les voisines de la courante.
  const pages: (number | "gap")[] = [];
  for (let n = 1; n <= pageCount; n++) {
    if (n === 1 || n === pageCount || Math.abs(n - page) <= 1) {
      pages.push(n);
    } else if (pages[pages.length - 1] !== "gap") {
      pages.push("gap");
    }
  }

  const stepClass =
    "min-w-8 rounded-md px-2 py-1 text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:text-neutral-400";

  return (
    <nav
      aria-label={label}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3"
    >
      <p className="text-sm text-neutral-600 tabular-nums" aria-live="polite">
        {rangeStart}&nbsp;–&nbsp;{rangeEnd} sur {total} {unit}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={`${stepClass} text-primary-500 hover:bg-muted`}
        >
          Précédent
        </button>
        {pages.map((n, i) =>
          n === "gap" ? (
            <span
              key={`gap-${i}`}
              className="px-1 text-sm text-neutral-400"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onPageChange(n)}
              aria-current={n === page ? "page" : undefined}
              className={`${stepClass} ${
                n === page
                  ? "bg-primary-800 font-semibold text-white"
                  : "text-primary-500 hover:bg-muted"
              }`}
            >
              {n}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === pageCount}
          className={`${stepClass} text-primary-500 hover:bg-muted`}
        >
          Suivant
        </button>
      </div>
    </nav>
  );
}

export { Pagination };
