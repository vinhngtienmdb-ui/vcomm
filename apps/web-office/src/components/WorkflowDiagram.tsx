"use client";

// Sơ đồ luồng quy trình tự vẽ, chỉ xem (QUYTAC_NGHIEPVU_360): bước xếp theo tầng tính từ bước đầu; tô màu theo trạng thái phiên.
import { workflowEnd, type WorkflowDefinition } from "contracts";
import { useTranslations } from "next-intl";

export type StepState = "done" | "open" | "waiting" | "blocked";

const boxWidth = 170;
const boxHeight = 40;
const columnGap = 90;
const rowGap = 70;

export function WorkflowDiagram({ definition, states = {} }: { definition: WorkflowDefinition; states?: Record<string, StepState> }) {
  const t = useTranslations("officeWorkflows");
  const keys = new Set(definition.steps.map((step) => step.key));
  // Tầng của bước = khoảng cách ngắn nhất từ bước đầu.
  const level = new Map<string, number>();
  const queue: string[] = keys.has(definition.firstStepKey) ? [definition.firstStepKey] : [];
  level.set(definition.firstStepKey, 0);
  const targetsOf = (key: string) => {
    const step = definition.steps.find((item) => item.key === key);
    if (!step) return [];
    return [
      ...step.transitions.map((transition) => ({ targets: transition.targets, label: labelOf(transition.outcome, transition.condition) })),
      ...(step.otherwise ? [{ targets: step.otherwise, label: t("otherwiseShort") }] : []),
    ];
  };
  function labelOf(outcome: string | null, condition: { fieldKey: string; operator: string; value: string } | null) {
    const field = condition ? (definition.fields.find((item) => item.key === condition.fieldKey)?.label ?? condition.fieldKey) : "";
    return [outcome ?? "", condition ? `${field} ${t(`operatorSymbol_${condition.operator}`)} ${condition.value}` : ""].filter(Boolean).join(", ");
  }
  while (queue.length > 0) {
    const key = queue.shift()!;
    for (const edge of targetsOf(key)) {
      for (const target of edge.targets) {
        if (target !== workflowEnd && keys.has(target) && !level.has(target)) {
          level.set(target, level.get(key)! + 1);
          queue.push(target);
        }
      }
    }
  }
  // Bước không đến được đặt ở tầng cuối để vẫn thấy trên sơ đồ.
  let maximum = Math.max(0, ...level.values());
  for (const step of definition.steps) if (!level.has(step.key)) level.set(step.key, maximum + 1);
  maximum = Math.max(0, ...level.values());
  level.set(workflowEnd, maximum + 1);
  const rows = new Map<number, string[]>();
  for (const [key, row] of level) rows.set(row, [...(rows.get(row) ?? []), key]);
  const widest = Math.max(...[...rows.values()].map((row) => row.length));
  const width = Math.max(1, widest) * (boxWidth + columnGap) + columnGap;
  const height = (maximum + 2) * (boxHeight + rowGap) + 20;
  const position = new Map<string, { x: number; y: number }>();
  for (const [row, items] of rows) {
    const offset = (width - items.length * (boxWidth + columnGap) + columnGap) / 2;
    items.forEach((key, index) => position.set(key, { x: offset + index * (boxWidth + columnGap), y: 20 + row * (boxHeight + rowGap) }));
  }
  const name = (key: string) => (key === workflowEnd ? t("end") : (definition.steps.find((step) => step.key === key)?.name ?? key));
  const fill = (state: StepState | undefined) =>
    state === "done" ? "var(--mau-thanh-cong-nen)" : state === "blocked" ? "var(--mau-loi-nen)" : state === "waiting" ? "var(--mau-canh-bao-nen)" : "var(--mau-be-mat)";
  return (
    <div className="khung-bang">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={t("diagram")}>
        <defs>
          <marker id="mui-ten" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="var(--mau-chu-phu)" />
          </marker>
        </defs>
        {definition.steps.flatMap((step) =>
          targetsOf(step.key).flatMap((edge, edgeIndex) =>
            edge.targets
              .filter((target) => position.has(target))
              .map((target) => {
                const from = position.get(step.key)!;
                const to = position.get(target)!;
                const x1 = from.x + boxWidth / 2;
                const y1 = from.y + boxHeight;
                const x2 = to.x + boxWidth / 2;
                const y2 = to.y;
                const sameRow = to.y === from.y;
                const backward = to.y < from.y || (sameRow && target === step.key);
                const right = to.x > from.x;
                // Cùng tầng mà không liền kề thì vẽ vòng cung phía dưới hàng để không xuyên qua ô ở giữa.
                const adjacent = Math.abs(to.x - from.x) <= boxWidth + columnGap + 1;
                // Cùng tầng: nối cạnh bên; quay lại bước trên: vòng cung bên phải để không đè các cạnh đi xuống.
                const path = backward
                  ? `M${from.x + boxWidth},${from.y + boxHeight / 2} C${from.x + boxWidth + 60},${from.y} ${to.x + boxWidth + 60},${to.y + boxHeight} ${to.x + boxWidth},${to.y + boxHeight / 2}`
                  : sameRow && adjacent
                    ? `M${right ? from.x + boxWidth : from.x},${from.y + boxHeight / 2} L${right ? to.x : to.x + boxWidth},${to.y + boxHeight / 2}`
                    : sameRow
                      ? `M${x1},${y1} Q${(x1 + x2) / 2},${y1 + rowGap * 0.8} ${x2},${y1}`
                      : `M${x1},${y1} L${x2},${y2}`;
                // Nhãn đặt gần đầu cạnh, so le theo thứ tự quy tắc để không đè nhau.
                const labelX = backward ? from.x + boxWidth + 8 : sameRow && adjacent ? (right ? from.x + boxWidth + 4 : from.x - 4) : sameRow ? (x1 + x2) / 2 : x1 + (x2 - x1) * 0.3 + 4;
                const labelY = backward ? from.y - 4 : sameRow && adjacent ? from.y + boxHeight / 2 - 6 : sameRow ? y1 + rowGap * 0.45 : y1 + (y2 - y1) * 0.3 + edgeIndex * 12;
                return (
                  <g key={`${step.key}-${edgeIndex}-${target}`}>
                    <path d={path} fill="none" stroke="var(--mau-chu-phu)" strokeWidth="1.5" markerEnd="url(#mui-ten)" />
                    {edge.label && (
                      <text x={labelX} y={labelY} textAnchor={sameRow && adjacent && !right ? "end" : sameRow ? "middle" : "start"} fontSize="11" fill="var(--mau-chu-phu)">
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              }),
          ),
        )}
        {[...position.entries()].map(([key, point]) => {
          const step = definition.steps.find((item) => item.key === key);
          const state = states[key];
          return (
            <g key={key}>
              <rect
                x={point.x}
                y={point.y}
                width={boxWidth}
                height={boxHeight}
                rx={key === workflowEnd || key === definition.firstStepKey ? 20 : 6}
                fill={fill(state)}
                stroke={state === "open" ? "var(--mau-chinh)" : "var(--mau-vien)"}
                strokeWidth={state === "open" ? 3 : 1}
              />
              <text x={point.x + boxWidth / 2} y={point.y + 24} textAnchor="middle" fontSize="12" fill="var(--mau-chu)">
                {name(key).length > 24 ? `${name(key).slice(0, 23)}…` : name(key)}
                {step?.kind === "join" ? ` (${t("joinShort")})` : ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
