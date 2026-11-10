// CONG_VIEC_06 lát L0, L1: đối tác dùng chung, đối tác nội bộ, che Căn cước công dân, hồ sơ đối tác của công ty (TIEUCHI_NGHIEMTHU_75 đến 79; KICHBAN_KIEMTHU_160 đến 164).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let retailAdmin: Session;
let tradingPartnerManager: Session;
let keeper: Session;
let employee: Session;
const retail: string = testIds.retailCompany;
const trading: string = testIds.tradingCompany;

async function assign(email: string, name: string, role: string, companyId: string) {
  const id = await createTestUser(pool, email, name, [{ companyId }]);
  const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [id, roleId, companyId]);
  return signIn(application, email);
}

const organization = {
  kind: "organization",
  name: "Công ty TNHH Bao Bì Xanh",
  shortName: "Bao Bì Xanh",
  taxCode: "0301234567",
  address: "12 Nguyễn Huệ, Quận 1",
  phone: "0281234567",
  email: "lienhe@baobixanh.test",
  contacts: [
    {
      fullName: "Trần Thị Mai",
      position: "Kế toán",
      phone: "0901234567",
      isPrimary: true,
    },
  ],
  bankAccounts: [
    {
      bankName: "Vietcombank",
      accountNo: "0071000123456",
      accountHolder: "CONG TY TNHH BAO BI XANH",
      isDefault: true,
    },
  ],
};

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  tradingPartnerManager = await assign("doitac.vct@vcomm.test", "Vũ Thị Đối", "partner_manager", trading);
  keeper = await assign("thukho.doitac@vcomm.test", "Lý Văn Kho", "warehouse_keeper", retail);
  employee = await assign("nhanvien.doitac@vcomm.test", "Hồ Thị Nhân", "employee", retail);
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_75, 76: đối tác dùng chung tập đoàn", () => {
  it("KICHBAN_KIEMTHU_160: mã số thuế bắt buộc, đúng định dạng, không trùng; kiểm trùng trả đối tác có sẵn", async () => {
    const missing = await retailAdmin.call("post", "/crm/partners", {
      companyId: retail,
      body: { ...organization, taxCode: null },
    });
    expect(missing.body.error.fields).toEqual({
      taxCode: "Vui lòng nhập thông tin này.",
    });
    const household = await retailAdmin.call("post", "/crm/partners", {
      companyId: retail,
      body: { kind: "household", name: "Hộ kinh doanh Tạp hóa Bé Ba" },
    });
    expect(Object.keys(household.body.error.fields)).toEqual(["taxCode"]);
    const wrongFormat = await retailAdmin.call("post", "/crm/partners", {
      companyId: retail,
      body: { ...organization, taxCode: "03012345" },
    });
    expect(Object.keys(wrongFormat.body.error.fields)).toEqual(["taxCode"]);
    expect(
      (
        await keeper.call("post", "/crm/partners", {
          companyId: retail,
          body: organization,
        })
      ).status,
    ).toBe(403);
    expect((await employee.call("get", "/crm/partners", { companyId: retail })).status).toBe(403);

    const created = await retailAdmin.call("post", "/crm/partners", {
      companyId: retail,
      body: organization,
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      code: expect.stringMatching(/^DT[0-9]{6}$/),
      kind: "organization",
      taxCode: "0301234567",
      internalCompanyId: null,
      canManage: true,
    });
    expect(created.body.contacts).toEqual([
      {
        fullName: "Trần Thị Mai",
        position: "Kế toán",
        phone: "0901234567",
        email: null,
        isPrimary: true,
      },
    ]);
    expect(created.body.bankAccounts[0]).toMatchObject({
      bankName: "Vietcombank",
      accountNo: "0071000123456",
    });

    const duplicate = await tradingPartnerManager.call("post", "/crm/partners", { companyId: trading, body: { ...organization, name: "Tên khác" } });
    expect(duplicate.body.error.fields).toEqual({
      taxCode: "Mã số thuế đã có ở đối tác khác trong tập đoàn.",
    });
    const lookup = await tradingPartnerManager.call("get", "/crm/partners/lookup?taxCode=0301234567", { companyId: trading });
    expect(lookup.body.partner).toEqual({
      id: created.body.id,
      code: created.body.code,
      name: organization.name,
    });
    expect((await tradingPartnerManager.call("get", "/crm/partners/lookup?taxCode=0399999999", { companyId: trading })).body.partner).toBeNull();
    // Mã số thuế đơn vị phụ thuộc là đối tác riêng.
    expect(
      (
        await retailAdmin.call("post", "/crm/partners", {
          companyId: retail,
          body: {
            ...organization,
            taxCode: "0301234567-001",
            name: "Chi nhánh Bao Bì Xanh",
          },
        })
      ).status,
    ).toBe(201);
  });

  it("KICHBAN_KIEMTHU_161: công ty khác thấy, sửa đối tác chung; sửa ghi nhật ký trước, sau; ngừng giao dịch không xóa", async () => {
    const created = await retailAdmin.call("post", "/crm/partners", {
      companyId: retail,
      body: {
        ...organization,
        taxCode: "0302222222",
        name: "Công ty Cổ phần Gạo Ngon",
      },
    });
    const id = created.body.id;
    const seen = await tradingPartnerManager.call("get", "/crm/partners?search=gao ngon", { companyId: trading });
    expect(seen.body.data.map((item: { id: string }) => item.id)).toEqual([id]);
    expect((await keeper.call("get", `/crm/partners/${id}`, { companyId: retail })).body).toMatchObject({ id, canManage: false });

    const updated = await tradingPartnerManager.call("patch", `/crm/partners/${id}`, {
      companyId: trading,
      body: {
        ...organization,
        taxCode: "0302222222",
        name: "Công ty Cổ phần Gạo Rất Ngon",
        version: 1,
      },
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      name: "Công ty Cổ phần Gạo Rất Ngon",
      version: 2,
    });
    const stale = await retailAdmin.call("patch", `/crm/partners/${id}`, {
      companyId: retail,
      body: { ...organization, taxCode: "0302222222", version: 1 },
    });
    expect(stale.status).toBe(409);
    const audit = await pool.query(
      "SELECT action, company_id, before_data->>'name' AS before_name, after_data->>'name' AS after_name FROM core.audit_events WHERE entity_id = $1 ORDER BY occurred_at",
      [id],
    );
    expect(audit.rows).toEqual([
      {
        action: "partner.create",
        company_id: retail,
        before_name: null,
        after_name: "Công ty Cổ phần Gạo Ngon",
      },
      {
        action: "partner.update",
        company_id: trading,
        before_name: "Công ty Cổ phần Gạo Ngon",
        after_name: "Công ty Cổ phần Gạo Rất Ngon",
      },
    ]);

    const stopped = await retailAdmin.call("post", `/crm/partners/${id}/deactivate`, { companyId: retail, body: { version: 2 } });
    expect(stopped.body.status).toBe("inactive");
    expect((await retailAdmin.call("get", `/crm/partners?status=inactive&search=0302222222`, { companyId: retail })).body.total).toBe(1);
    expect(
      (
        await retailAdmin.call("post", `/crm/partners/${id}/activate`, {
          companyId: retail,
          body: { version: 3 },
        })
      ).body.status,
    ).toBe("active");
  });
});

describe("TIEUCHI_NGHIEMTHU_77: đối tác nội bộ", () => {
  it("KICHBAN_KIEMTHU_162: mỗi công ty con đang hoạt động có đúng một đối tác nội bộ, không sửa được thông tin chung", async () => {
    const internal = await retailAdmin.call("get", "/crm/partners?role=internal", { companyId: retail });
    expect(internal.body.data.map((item: { internalCompanyId: string }) => item.internalCompanyId).sort()).toEqual([retail, trading].sort());
    await retailAdmin.call("get", "/crm/partners?role=internal", {
      companyId: retail,
    });
    const count = await pool.query("SELECT company_id, count(*)::int AS total FROM crm.partners WHERE company_id IS NOT NULL GROUP BY company_id ORDER BY company_id");
    expect(count.rows).toEqual([
      { company_id: retail, total: 1 },
      { company_id: trading, total: 1 },
    ]);
    const tradingPartner = internal.body.data.find((item: { internalCompanyId: string }) => item.internalCompanyId === trading);
    expect(tradingPartner).toMatchObject({
      taxCode: "0109876543",
      kind: "organization",
    });
    const detail = await retailAdmin.call("get", `/crm/partners/${tradingPartner.id}`, { companyId: retail });
    expect(detail.body.canManage).toBe(false);
    const edit = await retailAdmin.call("patch", `/crm/partners/${tradingPartner.id}`, {
      companyId: retail,
      body: {
        ...organization,
        taxCode: "0109876543",
        version: detail.body.version,
      },
    });
    expect(edit.body.error.message).toBe("Đối tác nội bộ lấy thông tin từ công ty, sửa ở màn hình Công ty.");
    expect((await retailAdmin.call("post", `/crm/partners/${tradingPartner.id}/deactivate`, { companyId: retail, body: { version: detail.body.version } })).status).toBe(409);
    // Mã số thuế của công ty con không dùng được cho đối tác bên ngoài.
    expect(
      (
        await retailAdmin.call("post", "/crm/partners", {
          companyId: retail,
          body: { ...organization, taxCode: "0109876543" },
        })
      ).body.error.fields,
    ).toEqual({ taxCode: "Mã số thuế đã có ở đối tác khác trong tập đoàn." });
    // Đổi tên công ty thì đối tác nội bộ đổi theo.
    await pool.query("UPDATE core.companies SET short_name = 'VComm TM' WHERE id = $1", [trading]);
    expect(
      (
        await retailAdmin.call("get", `/crm/partners/${tradingPartner.id}`, {
          companyId: retail,
        })
      ).body.shortName,
    ).toBe("VComm Thương mại");
    await retailAdmin.call("get", "/crm/partners?role=internal", {
      companyId: retail,
    });
    expect(
      (
        await retailAdmin.call("get", `/crm/partners/${tradingPartner.id}`, {
          companyId: retail,
        })
      ).body.shortName,
    ).toBe("VComm TM");
    await pool.query("UPDATE core.companies SET short_name = 'VComm Thương mại' WHERE id = $1", [trading]);
  });
});

describe("TIEUCHI_NGHIEMTHU_78: che số Căn cước công dân", () => {
  it("KICHBAN_KIEMTHU_163: cá nhân bắt buộc số Căn cước công dân; danh sách chỉ hiện 3 số cuối; xem đầy đủ cần quyền và ghi nhật ký", async () => {
    const missing = await retailAdmin.call("post", "/crm/partners", {
      companyId: retail,
      body: { kind: "individual", name: "Nguyễn Văn An" },
    });
    expect(missing.body.error.fields).toEqual({
      citizenId: "Vui lòng nhập thông tin này.",
    });
    expect(
      Object.keys(
        (
          await retailAdmin.call("post", "/crm/partners", {
            companyId: retail,
            body: {
              kind: "individual",
              name: "Nguyễn Văn An",
              citizenId: "07909001234",
            },
          })
        ).body.error.fields,
      ),
    ).toEqual(["citizenId"]);
    const created = await tradingPartnerManager.call("post", "/crm/partners", {
      companyId: trading,
      body: {
        kind: "individual",
        name: "Nguyễn Văn An",
        citizenId: "079090012345",
        phone: "0912345678",
      },
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      citizenIdMasked: "*********345",
      canViewIdentity: false,
    });
    expect(JSON.stringify(created.body)).not.toContain("079090012345");
    const duplicate = await retailAdmin.call("post", "/crm/partners", {
      companyId: retail,
      body: {
        kind: "individual",
        name: "Người khác",
        citizenId: "079090012345",
      },
    });
    expect(duplicate.body.error.fields).toEqual({
      citizenId: "Số Căn cước công dân đã có ở đối tác khác trong tập đoàn.",
    });

    const list = await retailAdmin.call("get", "/crm/partners?kind=individual", { companyId: retail });
    expect(JSON.stringify(list.body)).not.toContain("079090012345");
    expect(list.body.data[0].citizenIdMasked).toBe("*********345");
    // Nhật ký thêm đối tác không chứa số đầy đủ.
    const createdAudit = await pool.query("SELECT after_data::text AS after FROM core.audit_events WHERE entity_id = $1 AND action = 'partner.create'", [created.body.id]);
    expect(createdAudit.rows[0].after).not.toContain("079090012345");

    expect((await tradingPartnerManager.call("get", `/crm/partners/${created.body.id}/identity`, { companyId: trading })).status).toBe(403);
    const detail = await retailAdmin.call("get", `/crm/partners/${created.body.id}`, { companyId: retail });
    expect(detail.body.canViewIdentity).toBe(true);
    const identity = await retailAdmin.call("get", `/crm/partners/${created.body.id}/identity`, { companyId: retail });
    expect(identity.body).toEqual({ citizenId: "079090012345" });
    // Tra số Căn cước công dân chỉ dành cho người thêm, sửa đối tác.
    expect((await keeper.call("get", "/crm/partners/lookup?citizenId=079090012345", { companyId: retail })).status).toBe(403);
    expect((await retailAdmin.call("get", "/crm/partners/lookup?citizenId=079090012345", { companyId: retail })).body.partner.id).toBe(created.body.id);
    // Sửa không gõ lại số thì giữ số đã lưu.
    const edited = await retailAdmin.call("patch", `/crm/partners/${created.body.id}`, {
      companyId: retail,
      body: {
        kind: "individual",
        name: "Nguyễn Văn An Bình",
        citizenId: "",
        version: 1,
      },
    });
    expect(edited.body).toMatchObject({
      name: "Nguyễn Văn An Bình",
      citizenIdMasked: "*********345",
    });
    const viewed = await pool.query("SELECT action, company_id FROM core.audit_events WHERE entity_id = $1 AND action = 'partner.view_identity'", [created.body.id]);
    expect(viewed.rows).toEqual([{ action: "partner.view_identity", company_id: retail }]);
  });
});

describe("TIEUCHI_NGHIEMTHU_79: hồ sơ đối tác của công ty", () => {
  it("KICHBAN_KIEMTHU_164: hồ sơ riêng từng công ty; phải chọn khách hàng hoặc nhà cung cấp; hạn mức không âm; nhóm khách, người phụ trách thuộc công ty", async () => {
    const partner = await retailAdmin.call("post", "/crm/partners", {
      companyId: retail,
      body: {
        ...organization,
        taxCode: "0303333333",
        name: "Công ty TNHH Nông Sản Việt",
      },
    });
    const id = partner.body.id;
    const retailGroup = (await pool.query<{ id: string }>("INSERT INTO catalog.customer_groups (company_id, code, name) VALUES ($1, 'SI', 'Khách sỉ') RETURNING id", [retail])).rows[0]!.id;
    const tradingGroup = (await pool.query<{ id: string }>("INSERT INTO catalog.customer_groups (company_id, code, name) VALUES ($1, 'SI', 'Khách sỉ') RETURNING id", [trading])).rows[0]!.id;
    const options = await retailAdmin.call("get", "/crm/partner-profile-options", { companyId: retail });
    expect(options.body.customerGroups).toEqual([{ id: retailGroup, name: "Khách sỉ" }]);
    const ownerId = options.body.users[0].id;

    const base = {
      isCustomer: true,
      isSupplier: false,
      paymentTermDays: 30,
      creditLimit: "50000000",
      customerGroupId: retailGroup,
      ownerUserId: ownerId,
      note: "Giao buổi sáng",
      version: 0,
    };
    expect(
      (
        await retailAdmin.call("put", `/crm/partners/${id}/profile`, {
          companyId: retail,
          body: { ...base, isCustomer: false },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await retailAdmin.call("put", `/crm/partners/${id}/profile`, {
          companyId: retail,
          body: { ...base, creditLimit: "-1" },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await retailAdmin.call("put", `/crm/partners/${id}/profile`, {
          companyId: retail,
          body: { ...base, paymentTermDays: 366 },
        })
      ).status,
    ).toBe(400);
    const otherGroup = await retailAdmin.call("put", `/crm/partners/${id}/profile`, { companyId: retail, body: { ...base, customerGroupId: tradingGroup } });
    expect(Object.keys(otherGroup.body.error.fields)).toEqual(["customerGroupId"]);
    const foreignOwner = (
      await pool.query<{ user_id: string }>(
        "SELECT user_id FROM core.user_company_memberships WHERE company_id = $1 AND user_id NOT IN (SELECT user_id FROM core.user_company_memberships WHERE company_id = $2) LIMIT 1",
        [trading, retail],
      )
    ).rows[0]!.user_id;
    expect(
      Object.keys(
        (
          await retailAdmin.call("put", `/crm/partners/${id}/profile`, {
            companyId: retail,
            body: { ...base, ownerUserId: foreignOwner },
          })
        ).body.error.fields,
      ),
    ).toEqual(["ownerUserId"]);
    expect(
      (
        await tradingPartnerManager.call("put", `/crm/partners/${id}/profile`, {
          companyId: trading,
          body: base,
        })
      ).status,
    ).toBe(403);

    const saved = await retailAdmin.call("put", `/crm/partners/${id}/profile`, {
      companyId: retail,
      body: base,
    });
    expect(saved.status).toBe(200);
    expect(saved.body.profile).toMatchObject({
      companyId: retail,
      isCustomer: true,
      creditLimit: "50000000",
      customerGroupName: "Khách sỉ",
      paymentTermDays: 30,
      version: 1,
    });
    expect(
      (
        await retailAdmin.call("put", `/crm/partners/${id}/profile`, {
          companyId: retail,
          body: base,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await retailAdmin.call("get", "/crm/partners?role=customer", {
          companyId: retail,
        })
      ).body.data.map((item: { id: string }) => item.id),
    ).toEqual([id]);

    // Công ty khác không thấy hồ sơ của công ty A.
    const fromTrading = await tradingPartnerManager.call("get", `/crm/partners/${id}`, { companyId: trading });
    expect(fromTrading.body).toMatchObject({
      id,
      profile: null,
      isCustomer: false,
    });
    expect(
      (
        await tradingPartnerManager.call("get", "/crm/partners?role=customer", {
          companyId: trading,
        })
      ).body.total,
    ).toBe(0);

    // Không lập hồ sơ cho chính công ty đang chọn.
    const self = (await pool.query<{ id: string }>("SELECT id FROM crm.partners WHERE company_id = $1", [retail])).rows[0]!.id;
    const selfProfile = await retailAdmin.call("put", `/crm/partners/${self}/profile`, {
      companyId: retail,
      body: { ...base, customerGroupId: null, ownerUserId: null },
    });
    expect(Object.keys(selfProfile.body.error.fields)).toEqual(["partnerId"]);
    const audit = await pool.query("SELECT action, entity_type FROM core.audit_events WHERE entity_id = $1 AND entity_type = 'partner_profile'", [id]);
    expect(audit.rows).toEqual([{ action: "partner_profile.save", entity_type: "partner_profile" }]);
  });
});
