import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { FeasibilityService } from './feasibility.service';
import { SettingsService } from '../settings/settings.service';

const FEASIBILITY_URL = process.env.FEASIBILITY_URL || 'http://localhost:3001';
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET || '';
import { PriorArtService } from '../prior-art/prior-art.service';
import { PatchStageDto } from './dto/patch-stage.dto';
import { PatchRunDto } from './dto/patch-run.dto';
import { StartRunDto } from './dto/start-run.dto';
import { RerunFromStageDto } from './dto/rerun-from-stage.dto';

@Controller('projects/:id/feasibility')
export class FeasibilityController {
  constructor(
    private readonly feasibilityService: FeasibilityService,
    private readonly settingsService: SettingsService,
    private readonly priorArtService: PriorArtService,
  ) {}

  @Post('run')
  @HttpCode(HttpStatus.CREATED)
  async startRun(
    @Param('id') projectId: string,
    @Body() body: StartRunDto,
  ) {
    // Enforce cost cap before starting a new run
    const settings = await this.settingsService.getSettings();
    if (settings.costCapUsd > 0) {
      const spent = await this.feasibilityService.getProjectCumulativeCost(projectId);
      if (spent >= settings.costCapUsd) {
        throw new BadRequestException(
          `Cost cap exceeded. You have spent $${spent.toFixed(2)} of your $${settings.costCapUsd.toFixed(2)} cap. ` +
          `Increase the cost cap in Settings to continue.`,
        );
      }
    }

    const run = await this.feasibilityService.startRun(projectId);
    // Kick off prior art search in background (non-blocking)
    if (settings.anthropicApiKey && body?.narrative) {
      this.priorArtService.startSearch(
        projectId,
        run.id,
        body.narrative,
        settings.anthropicApiKey,
        settings.usptoApiKey || undefined,
      );
    }
    return run;
  }

  @Get()
  getLatest(@Param('id') projectId: string) {
    return this.feasibilityService.getLatest(projectId);
  }

  @Get('runs')
  getAllRuns(@Param('id') projectId: string) {
    return this.feasibilityService.getAllRuns(projectId);
  }

  @Get('export/docx')
  async exportToDocx(@Param('id') projectId: string, @Res() res: Response) {
    const { buffer, filename } = await this.feasibilityService.getDocxBuffer(projectId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('cost-estimate')
  getCostEstimate(@Param('id') projectId: string) {
    return this.feasibilityService.getCostEstimate(projectId);
  }

  @Get(':version')
  getByVersion(
    @Param('id') projectId: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.feasibilityService.getByVersion(projectId, version);
  }

  @Patch('run')
  @HttpCode(HttpStatus.OK)
  patchRun(
    @Param('id') projectId: string,
    @Body() dto: PatchRunDto,
  ) {
    return this.feasibilityService.patchRun(projectId, dto);
  }

  @Patch('stages/:stageNumber')
  async patchStage(
    @Param('id') projectId: string,
    @Param('stageNumber', ParseIntPipe) stageNumber: number,
    @Body() dto: PatchStageDto,
  ) {
    const result = await this.feasibilityService.patchStage(projectId, stageNumber, dto);

    // After writing cost data, check if cumulative cost exceeds cap
    // Return a flag so the frontend can abort the pipeline
    let costCapExceeded = false;
    let cumulativeCost = 0;
    let costCapUsd = 0;
    if (dto.estimatedCostUsd !== undefined && dto.estimatedCostUsd > 0) {
      const settings = await this.settingsService.getSettings();
      costCapUsd = settings.costCapUsd;
      if (costCapUsd > 0) {
        cumulativeCost = await this.feasibilityService.getProjectCumulativeCost(projectId);
        costCapExceeded = cumulativeCost >= costCapUsd;
      }
    }

    return { ...result, costCapExceeded, cumulativeCost, costCapUsd };
  }

  /**
   * SSE proxy — forwards the analysis request to the feasibility service
   * and streams the response back to the browser. This keeps the feasibility
   * service internal (not directly reachable from the browser).
   */
  @Post('stream')
  async streamAnalysis(
    @Param('id') projectId: string,
    @Body() body: any,
    @Res() res: Response,
  ) {
    // Inject the API key server-side — never trust the frontend to send it
    const settings = await this.settingsService.getSettings();
    if (!settings.anthropicApiKey) {
      res.status(400).json({ error: 'No Anthropic API key configured. Add one in Settings.' });
      return;
    }

    const forwardBody = {
      ...body,
      settings: {
        ...(body.settings || {}),
        apiKey: settings.anthropicApiKey,
      },
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (INTERNAL_SECRET) {
      headers['X-Internal-Secret'] = INTERNAL_SECRET;
    }

    try {
      const upstream = await fetch(`${FEASIBILITY_URL}/analyze`, {
        method: 'POST',
        headers,
        body: JSON.stringify(forwardBody),
      });

      if (!upstream.ok) {
        const text = await upstream.text();
        res.status(upstream.status).json({ error: text });
        return;
      }

      // Set SSE headers and pipe the upstream response body through
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const reader = (upstream.body as any).getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
      } catch {
        // Client disconnected or upstream closed
      } finally {
        res.end();
      }
    } catch (err: any) {
      res.status(502).json({ error: `Feasibility service unavailable: ${err.message}` });
    }
  }

  @Post('rerun')
  @HttpCode(HttpStatus.CREATED)
  async rerunFromStage(
    @Param('id') projectId: string,
    @Body() dto: RerunFromStageDto,
  ) {
    return this.feasibilityService.rerunFromStage(projectId, dto.fromStage);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  cancelRun(@Param('id') projectId: string) {
    return this.feasibilityService.cancelRun(projectId);
  }

  @Post('export')
  @HttpCode(HttpStatus.OK)
  async exportReportToDisk(@Param('id') projectId: string) {
    const settings = await this.settingsService.getSettings();
    return this.feasibilityService.exportReportToDisk(projectId, settings.exportPath);
  }
}
