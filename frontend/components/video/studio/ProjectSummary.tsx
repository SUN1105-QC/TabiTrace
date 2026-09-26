/** PROJECT SUMMARY：当前配置的两列数据，不拆成独立卡片。 */

export function ProjectSummary({ rows }: { rows: [string, string][] }) {
  return (
    <section className="vs-card vs-summary">
      <p className="vs-kicker">PROJECT SUMMARY</p>
      <dl>
        {rows.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd title={v}>{v}</dd></div>
        ))}
      </dl>
    </section>
  )
}
