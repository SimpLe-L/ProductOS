export interface RunListItem {
  id: string;
  title: string;
  updatedAt: string;
}

export function RunList({
  empty,
  items,
  onOpen,
}: {
  empty: string;
  items: RunListItem[];
  onOpen?: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="m-0 text-[11px] text-muted-foreground">{empty}</p>;
  }

  return (
    <div className="grid gap-0">
      {items.map((item) => {
        const content = (
          <>
            <strong className="[overflow-wrap:anywhere] text-xs font-semibold text-foreground">
              {item.title}
            </strong>
            <span className="text-[11px] text-muted-foreground">
              {new Date(item.updatedAt).toLocaleString()}
            </span>
          </>
        );

        return onOpen ? (
          <button
            className="grid gap-1 border-b border-border/80 py-2.5 text-left transition-colors hover:text-primary"
            key={item.id}
            onClick={() => onOpen(item.id)}
          >
            {content}
          </button>
        ) : (
          <article className="grid gap-1 border-b border-border/80 py-2.5" key={item.id}>
            {content}
          </article>
        );
      })}
    </div>
  );
}
