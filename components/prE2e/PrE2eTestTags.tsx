export function PrE2eTestTags({
  tags,
  className = "",
}: {
  tags: string[];
  className?: string;
}) {
  if (!tags.length) return null;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded border border-violet-100 bg-violet-50/80 px-1.5 py-0.5 font-mono text-[10px] text-violet-900"
          title={tag}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
