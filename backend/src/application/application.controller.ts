import { Controller, Get, Post, Patch, Param, Body, ParseIntPipe, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApplicationService } from './application.service';
import { UpdateSectionDto } from './dto/update-section.dto';

@Controller('projects/:id/application')
export class ApplicationController {
  constructor(private readonly service: ApplicationService) {}

  /** POST /api/projects/:id/application — Start application generation */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  startGeneration(@Param('id') projectId: string) {
    return this.service.startGeneration(projectId);
  }

  /** GET /api/projects/:id/application — Get latest application */
  @Get()
  getLatest(@Param('id') projectId: string) {
    return this.service.getLatest(projectId);
  }

  /** GET /api/projects/:id/application/:version — Get specific version */
  @Get(':version')
  getByVersion(
    @Param('id') projectId: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.service.getByVersion(projectId, version);
  }

  /** PATCH /api/projects/:id/application/sections/:name — Edit a section */
  @Patch('sections/:name')
  @HttpCode(HttpStatus.OK)
  updateSection(
    @Param('id') projectId: string,
    @Param('name') sectionName: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.service.updateSection(projectId, sectionName, dto.content);
  }

  /** GET /api/projects/:id/application/export/docx — Download Word document */
  @Get('export/docx')
  async exportDocx(@Param('id') projectId: string, @Res() res: Response) {
    const { buffer, filename } = await this.service.exportDocx(projectId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  /** GET /api/projects/:id/application/export/pdf — Download PDF */
  @Get('export/pdf')
  async exportPdf(@Param('id') projectId: string, @Res() res: Response) {
    const { buffer, filename } = await this.service.exportPdf(projectId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  /** GET /api/projects/:id/application/export/markdown — Download Markdown */
  @Get('export/markdown')
  async exportMarkdown(@Param('id') projectId: string, @Res() res: Response) {
    const { text, filename } = await this.service.exportMarkdown(projectId);
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(text);
  }
}
