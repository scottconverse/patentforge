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
} from '@nestjs/common';
import { FeasibilityService } from './feasibility.service';
import { PatchStageDto } from './dto/patch-stage.dto';

@Controller('projects/:id/feasibility')
export class FeasibilityController {
  constructor(private readonly feasibilityService: FeasibilityService) {}

  @Post('run')
  @HttpCode(HttpStatus.CREATED)
  startRun(@Param('id') projectId: string) {
    return this.feasibilityService.startRun(projectId);
  }

  @Get()
  getLatest(@Param('id') projectId: string) {
    return this.feasibilityService.getLatest(projectId);
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
    @Body() dto: { status?: string; finalReport?: string; startedAt?: string; completedAt?: string },
  ) {
    return this.feasibilityService.patchRun(projectId, dto as any);
  }

  @Patch('stages/:stageNumber')
  patchStage(
    @Param('id') projectId: string,
    @Param('stageNumber', ParseIntPipe) stageNumber: number,
    @Body() dto: PatchStageDto,
  ) {
    return this.feasibilityService.patchStage(projectId, stageNumber, dto);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  cancelRun(@Param('id') projectId: string) {
    return this.feasibilityService.cancelRun(projectId);
  }
}
