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
import { Response } from 'express';
import { FeasibilityService } from './feasibility.service';
import { SettingsService } from '../settings/settings.service';
import { PriorArtService } from '../prior-art/prior-art.service';
import { PatchStageDto } from './dto/patch-stage.dto';
import { PatchRunDto } from './dto/patch-run.dto';

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
    @Body() body: { narrative?: string },
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
  patchStage(
    @Param('id') projectId: string,
    @Param('stageNumber', ParseIntPipe) stageNumber: number,
    @Body() dto: PatchStageDto,
  ) {
    return this.feasibilityService.patchStage(projectId, stageNumber, dto);
  }

  @Post('rerun')
  @HttpCode(HttpStatus.CREATED)
  async rerunFromStage(
    @Param('id') projectId: string,
    @Body() body: { fromStage: number },
  ) {
    return this.feasibilityService.rerunFromStage(projectId, body.fromStage);
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
