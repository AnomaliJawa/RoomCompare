/**
 * Buttons centre on the title and lede together (the user's choice). On a phone they run full width
 * below: text buttons pass max-lg:flex-1; icon buttons keep their size, or the icon would float.
 */
export function PageHead({ title, lede, titleAside = null, actions = null }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4 max-lg:flex-col max-lg:items-stretch">
      <div className="min-w-0">
        {titleAside ? (
          <div className="flex items-center gap-2">
            <h1>{title}</h1>
            {titleAside}
          </div>
        ) : (
          <h1>{title}</h1>
        )}
        <p className="mt-2 text-muted" data-lede>
          {lede}
        </p>
      </div>
      {actions && (
        <div className="flex shrink-0 gap-2 pointer-coarse:gap-3" data-page-actions>
          {actions}
        </div>
      )}
    </div>
  );
}
