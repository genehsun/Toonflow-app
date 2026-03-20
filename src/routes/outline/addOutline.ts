import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

// 新增大纲（事务：同时创建空白剧本）
export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    data: z.string(),
    episode: z.number().optional(),
  }),
  async (req, res) => {
    const { projectId, data, episode } = req.body;

    // 脚本名由服务端推导：优先用 episode 参数，兜底从 data JSON 解析 episodeIndex
    let ep = episode;
    if (ep == null) {
      try {
        const parsed = JSON.parse(data);
        if (typeof parsed.episodeIndex === "number") ep = parsed.episodeIndex;
      } catch {
        // data 解析失败则留空
      }
    }
    const scriptName = ep != null ? `第${ep}集` : "";

    const id = await u.db.transaction(async (trx) => {
      const [outlineId] = await trx("t_outline").insert({
        data,
        projectId,
        episode: episode ?? null,
      });

      await trx("t_script").insert({
        name: scriptName,
        content: "",
        projectId,
        outlineId,
      });

      return outlineId;
    });

    res.status(200).send(success({ message: "新增大纲成功", id }));
  }
);
