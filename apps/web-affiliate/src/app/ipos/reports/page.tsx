"use client";

// MAN_HINH_300 Báo cáo iPOS (chủ cửa hàng; CONG_VIEC_74; QUYTAC_NGHIEPVU_625; API_351): doanh thu thuần, phương thức, theo giờ, hàng bán chạy,
// lợi nhuận gộp theo giá vốn lúc bán, ca, tồn kho; xuất Excel. Khoảng ngày tối đa 366 ngày.
import type { IposPortalAccess, IposReport } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDateTime, formatNumber } from "ui/lib/format";
import { daysAgo, IposPeriod, periodQuery, vietnamToday, type IposPeriodValue } from "@/components/IposPeriod";
import { portalDownload, usePortalApi } from "@/lib/portal-api";

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="the">
      <span className="chu-thich">{label}</span>
      <strong style={{ fontSize: 22 }}>{value}</strong>
      {note && <span className="chu-thich">{note}</span>}
    </div>
  );
}

// Thanh ngang tỷ lệ theo giá trị lớn nhất của bảng (một màu, có số bên cạnh).
function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div style={{ background: "var(--mau-vien)", borderRadius: 4, height: 8, minWidth: 80 }}>
      <div style={{ width: `${max <= 0 ? 0 : Math.max(0, (value / max) * 100)}%`, background: "var(--mau-chinh)", height: 8, borderRadius: 4 }} />
    </div>
  );
}

export default function IposReportsPage() {
  const t = useTranslations("iposPortal");
  const access = usePortalApi<IposPortalAccess>("/merchant-portal/ipos/access");
  const [period, setPeriod] = useState<IposPeriodValue>({ from: daysAgo(6), to: vietnamToday(), outletId: "" });
  const { state, reload } = usePortalApi<IposReport>(`/merchant-portal/ipos/reports?${periodQuery(period)}`);
  const [exporting, setExporting] = useState(false);
  return (
    <Loaded state={access.state} onRetry={() => void access.reload()}>
      {(info) =>
        !info.enabled ? (
          <MessageView text={t("notSubscribed")} />
        ) : (
          <>
            <div className="tieu-de">
              <h1>{t("reportsTitle")}</h1>
            </div>
            <IposPeriod value={period} outlets={info.outlets} onChange={setPeriod}>
              <div className="nhom-nut">
                <button
                  type="button"
                  className={`nut phu${exporting ? " dang-xu-ly" : ""}`}
                  disabled={exporting}
                  onClick={() => {
                    setExporting(true);
                    void portalDownload(`/merchant-portal/ipos/reports/export?${periodQuery(period)}`, `bao-cao-ipos-${period.from}-${period.to}.xlsx`).finally(() => setExporting(false));
                  }}
                >
                  {t("exportExcel")}
                </button>
              </div>
            </IposPeriod>
            <Loaded state={state} onRetry={() => void reload()}>
              {(report) => {
                const maxDay = Math.max(...report.byDay.map((row) => Number(row.net)), 0);
                const maxHour = Math.max(...report.byHour.map((row) => Number(row.net)), 0);
                return (
                  <>
                    <div className="luoi-so">
                      <Tile label={t("netRevenue")} value={formatNumber(report.netRevenue)} note={t("netNote", { gross: formatNumber(report.grossSales), returns: formatNumber(report.returns) })} />
                      <Tile label={t("salesCount")} value={formatNumber(report.salesCount)} note={t("returnsCountNote", { count: report.returnsCount })} />
                      <Tile label={t("averageSale")} value={formatNumber(report.averageSale)} />
                      <Tile label={t("grossProfit")} value={formatNumber(report.grossProfit)} note={t("grossProfitNote")} />
                    </div>
                    <h2>{t("byDay")}</h2>
                    <div className="khung-bang">
                      <table>
                        <thead>
                          <tr>
                            <th>{t("day")}</th>
                            <th className="so">{t("salesCount")}</th>
                            <th className="so">{t("netRevenue")}</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {report.byDay.map((row) => (
                            <tr key={row.day}>
                              <td data-nhan={t("day")}>{row.day.split("-").reverse().join("/")}</td>
                              <td data-nhan={t("salesCount")} className="so">
                                {row.sales}
                              </td>
                              <td data-nhan={t("netRevenue")} className="so">
                                {formatNumber(row.net)}
                              </td>
                              <td>
                                <Bar value={Number(row.net)} max={maxDay} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="luoi-so" style={{ alignItems: "start", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
                      <div>
                        <h2>{t("byMethod")}</h2>
                        <div className="khung-bang">
                          <table>
                            <tbody>
                              {report.byMethod.length === 0 ? (
                                <tr>
                                  <td>{t("noData")}</td>
                                </tr>
                              ) : (
                                report.byMethod.map((row) => (
                                  <tr key={row.method}>
                                    <td>{t(`method_${row.method}`)}</td>
                                    <td className="so">{formatNumber(row.amount)}</td>
                                  </tr>
                                ))
                              )}
                              <tr>
                                <td>{t("cashRefunds")}</td>
                                <td className="so">−{formatNumber(report.cashRefunds)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div>
                        <h2>{t("byHour")}</h2>
                        <div className="khung-bang">
                          <table>
                            <tbody>
                              {report.byHour.length === 0 ? (
                                <tr>
                                  <td>{t("noData")}</td>
                                </tr>
                              ) : (
                                report.byHour.map((row) => (
                                  <tr key={row.hour}>
                                    <td>{t("hourRange", { hour: row.hour, next: row.hour + 1 })}</td>
                                    <td className="so">{formatNumber(row.net)}</td>
                                    <td>
                                      <Bar value={Number(row.net)} max={maxHour} />
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                    <h2>{t("topItems")}</h2>
                    {report.topItems.length === 0 ? (
                      <p className="chu-thich">{t("noData")}</p>
                    ) : (
                      <div className="khung-bang">
                        <table>
                          <thead>
                            <tr>
                              <th>{t("item")}</th>
                              <th className="so">{t("soldQuantity")}</th>
                              <th className="so">{t("revenue")}</th>
                              <th className="so">{t("cost")}</th>
                              <th className="so">{t("grossProfit")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {report.topItems.map((row) => (
                              <tr key={row.variantId}>
                                <td data-nhan={t("item")}>
                                  {row.itemCode} · {row.name}
                                </td>
                                <td data-nhan={t("soldQuantity")} className="so">
                                  {formatNumber(row.quantity)}
                                </td>
                                <td data-nhan={t("revenue")} className="so">
                                  {formatNumber(row.revenue)}
                                </td>
                                <td data-nhan={t("cost")} className="so">
                                  {row.cost === null ? t("noCost") : formatNumber(row.cost)}
                                </td>
                                <td data-nhan={t("grossProfit")} className="so">
                                  {row.grossProfit === null ? "—" : formatNumber(row.grossProfit)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <h2>{t("shiftsTitle")}</h2>
                    {report.shifts.length === 0 ? (
                      <p className="chu-thich">{t("noShifts")}</p>
                    ) : (
                      <div className="khung-bang">
                        <table>
                          <thead>
                            <tr>
                              <th>{t("registerName")}</th>
                              <th>{t("cashier")}</th>
                              <th>{t("openedAt")}</th>
                              <th className="so">{t("revenue")}</th>
                              <th className="so">{t("difference")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {report.shifts.map((row) => (
                              <tr key={row.id}>
                                <td data-nhan={t("registerName")}>
                                  {row.outletName} · {row.registerName}
                                </td>
                                <td data-nhan={t("cashier")}>{row.memberName}</td>
                                <td data-nhan={t("openedAt")}>{formatDateTime(row.openedAt)}</td>
                                <td data-nhan={t("revenue")} className="so">
                                  {formatNumber(row.revenue)}
                                </td>
                                <td data-nhan={t("difference")} className="so">
                                  {row.difference === null ? t("shiftOpen") : formatNumber(row.difference)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <h2>{t("stockTitle")}</h2>
                    <div className="khung-bang">
                      <table>
                        <thead>
                          <tr>
                            <th>{t("outlet")}</th>
                            <th className="so">{t("stockItems")}</th>
                            <th className="so">{t("stockValue")}</th>
                            <th className="so">{t("negativeCount")}</th>
                            <th className="so">{t("belowMinCount")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.stock.map((row) => (
                            <tr key={row.outletName}>
                              <td data-nhan={t("outlet")}>{row.outletName}</td>
                              <td data-nhan={t("stockItems")} className="so">
                                {row.items}
                              </td>
                              <td data-nhan={t("stockValue")} className="so">
                                {formatNumber(row.value)}
                              </td>
                              <td data-nhan={t("negativeCount")} className="so">
                                {row.negative}
                              </td>
                              <td data-nhan={t("belowMinCount")} className="so">
                                {row.belowMin}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              }}
            </Loaded>
          </>
        )
      }
    </Loaded>
  );
}
