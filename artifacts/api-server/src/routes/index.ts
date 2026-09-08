import { Router, type IRouter } from "express";
import healthRouter from "./health";
import agrirescueRouter from "./agrirescue";

const router: IRouter = Router();

router.use(healthRouter);
router.use(agrirescueRouter);

export default router;
