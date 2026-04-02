import { Controller, Get, Post, Put, Param, Body, ParseIntPipe, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApplicationService } from './application.service';
import { UpdateSectionDto } from './dto/update-section.dto';

@Controller('projects/:id/application')
export class ApplicationController {
  constructor(private readonly service: ApplicationService) {}

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  startGeneration(@Param('id') projectId: string) {
    return this.service.startGeneration(projectId);
  }

  @Get()
  getLatest(@Param('id') projectId: string) {
    return this.service.getLatest(projectId);
  }

  @Get('export/docx')
  async exportToDocx(@Param('id') projectId: string, @Res() res: Response) {
    const { buffer, filename } = await this.service.getDocxBuffer(projectId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('export/markdown')
  async exportToMarkdown(@Param('id') projectId: string, @Res() res: Response) {
    const { text, filename } = await this.service.getMarkdown(projectId);
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(text);
  }

  @Get(':version')
  getByVersion(
    @Param('id') projectId: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.service.getByVersion(projectId, version);
  }

  @Put('sections/:name')
  @HttpCode(HttpStatus.OK)
  updateSection(
    @Param('id') projectId: string,
    @Param('name') sectionName: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.service.updateSection(projectId, sectionName, dto.text);
  }
}
