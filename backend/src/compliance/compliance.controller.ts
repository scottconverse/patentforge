import { Controller, Get, Post, Param, Body, ParseIntPipe, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { ComplianceService } from './compliance.service';
import { StartComplianceDto } from './dto/start-compliance.dto';

@Controller('projects/:id/compliance')
export class ComplianceController {
  constructor(private readonly service: ComplianceService) {}

  /** POST /api/projects/:id/compliance/check -- Start compliance check */
  @Post('check')
  @HttpCode(HttpStatus.CREATED)
  startCheck(@Param('id') projectId: string, @Body() dto: StartComplianceDto) {
    return this.service.startCheck(projectId, dto.draftVersion);
  }

  /** GET /api/projects/:id/compliance -- Get latest compliance check */
  @Get()
  getLatest(@Param('id') projectId: string) {
    return this.service.getLatest(projectId);
  }

  /** GET /api/projects/:id/compliance/export/docx -- Export compliance results as Word document */
  @Get('export/docx')
  async exportToDocx(@Param('id') projectId: string, @Res() res: Response) {
    const { buffer, filename } = await this.service.getDocxBuffer(projectId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  /** GET /api/projects/:id/compliance/:version -- Get specific version */
  @Get(':version')
  getByVersion(@Param('id') projectId: string, @Param('version', ParseIntPipe) version: number) {
    return this.service.getByVersion(projectId, version);
  }
}
