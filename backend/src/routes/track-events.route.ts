import { Router } from "express";
import { upsertUserTrackEventsController, newEventTrackEventController } from "../controllers/track-events.controller";

const router = Router();

router.post("/upsert-user", upsertUserTrackEventsController);
router.post("/new-event", newEventTrackEventController);

export default router;
