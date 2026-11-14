import { Router, type IRouter } from "express";
import healthRouter from "./health";
import agrirescueRouter from "./agrirescue";
import uploadRouter from "./upload";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/upload", uploadRouter);
router.use(agrirescueRouter);

export default router;
