type Props = {
  className?: string;
};

export function MysqlConnectionErrorBanner({ className = "" }: Props) {
  return (
    <p
      role="alert"
      className={`rounded-[10px] border border-amber-200/60 bg-amber-50/80 px-4 py-3 text-sm leading-relaxed text-amber-950 ${className}`.trim()}
    >
      Could not connect to MySQL — charts and tables below may be empty. Check VPN
      or internal network access to{" "}
      <code className="rounded border border-amber-200/80 bg-amber-100/50 px-1 py-0.5 font-mono text-xs">
        HEALTH_CHECK_MYSQL_HOST
      </code>
      , then refresh this page.
    </p>
  );
}
