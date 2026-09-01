import { Router, type IRouter } from "express";
import healthRouter from "./health";
import categoriesRouter from "./categories";
import productsRouter from "./products";
import servicesRouter from "./services";
import serviceCategoriesRouter from "./service-categories";
import portfolioRouter from "./portfolio";
import ordersRouter from "./orders";
import reviewsRouter from "./reviews";
import messagesRouter from "./messages";
import clientsRouter from "./clients";
import settingsRouter, { noticeRouter, noticesRouter } from "./settings";
import statsRouter from "./stats";
import invoicesRouter from "./invoices";
import inventoryRouter from "./inventory";
import adminRouter from "./admin";
import crmProjectsRouter from "./crm-projects";
import couponsRouter from "./coupons";
import projectServiceTypesRouter from "./project-service-types";
import labelCalculatorRouter from "./label-calculator";
import priceListsRouter from "./price-lists";
import shippingLabelsRouter from "./shipping-labels";
import financeInventoryRouter from "./finance-inventory";
import reportsRouter from "./reports";
import { requireNoticesSchema } from "../lib/ensure-notices-schema";
import customProjectsPublicRouter from "./custom-projects";
import deletionRequestsRouter from "./deletion-requests";
import clientVerificationsRouter, { publicClientVerificationsRouter } from "./client-verifications";
import staffVerificationsRouter, { publicStaffVerificationsRouter } from "./staff-verifications";
import clientAgreementsRouter, { publicClientAgreementsRouter } from "./client-agreements";
import staffProfilesRouter from "./staff-profiles";
import { orderClientAndDeletionMiddleware } from "./order-client-sync";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/categories", categoriesRouter);
router.use("/products", productsRouter);
router.use("/services", servicesRouter);
router.use("/service-categories", serviceCategoriesRouter);
router.use("/portfolio", portfolioRouter);
router.use("/orders", orderClientAndDeletionMiddleware, ordersRouter);
router.use("/reviews", reviewsRouter);
router.use("/messages", messagesRouter);
router.use("/clients", clientsRouter);
router.use("/client-verifications", publicClientVerificationsRouter);

// Authentication routes (/login, /verify-pin, /me, /logout) must be reached
// before any owner-gated feature router mounted at /admin. Otherwise a global
// requireOwner middleware can reject a signed-out login request as Unauthorized.
router.use("/admin", adminRouter);
router.use("/admin", clientVerificationsRouter);
router.use("/staff-verifications", publicStaffVerificationsRouter);
router.use("/client-agreements", publicClientAgreementsRouter);
router.use("/admin", staffVerificationsRouter);
router.use("/admin", clientAgreementsRouter);
router.use("/admin", staffProfilesRouter);
router.use("/settings", settingsRouter);
router.use("/notice", noticeRouter);
router.use("/notices", requireNoticesSchema, noticesRouter);
router.use("/stats", statsRouter);
router.use("/invoices", invoicesRouter);
router.use("/inventory", inventoryRouter);
router.use("/admin/deletion-requests", deletionRequestsRouter);
router.use("/crm-projects", crmProjectsRouter);
router.use("/custom-projects", customProjectsPublicRouter);
router.use("/coupons", couponsRouter);
router.use("/project-service-types", projectServiceTypesRouter);
router.use("/label-calculator", labelCalculatorRouter);
router.use("/price-lists", priceListsRouter);
router.use("/shipping-labels", shippingLabelsRouter);
router.use("/finance-inventory", financeInventoryRouter);
router.use("/reports", reportsRouter);

export default router;
