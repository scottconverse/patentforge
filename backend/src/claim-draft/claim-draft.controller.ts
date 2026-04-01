import { Controller, Get, Post, Put, Param, Body, ParseIntPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ClaimDraftService } from './claim-draft.service';
import { UpdateClaimDto } from './dto/update-claim.dto';

@Controller('projects/:id/claims')
export class ClaimDraftController {
  constructor(private readonly service: ClaimDraftService) {}

  /** POST /api/projects/:id/claims/draft — Start claim generation */
  @Post('draft')
  @HttpCode(HttpStatus.CREATED)
  startDraft(@Param('id') projectId: string) {
    return this.service.startDraft(projectId);
  }

  /** GET /api/projects/:id/claims — Get latest claim draft */
  @Get()
  getLatest(@Param('id') projectId: string) {
    return this.service.getLatest(projectId);
  }

  /** GET /api/projects/:id/claims/:version — Get specific version */
  @Get(':version')
  getByVersion(
    @Param('id') projectId: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.service.getByVersion(projectId, version);
  }

  /** PUT /api/projects/:id/claims/edit/:claimId — Update claim text */
  @Put('edit/:claimId')
  @HttpCode(HttpStatus.OK)
  updateClaim(
    @Param('id') projectId: string,
    @Param('claimId') claimId: string,
    @Body() dto: UpdateClaimDto,
  ) {
    return this.service.updateClaim(projectId, claimId, dto.text);
  }

  /** POST /api/projects/:id/claims/:claimNumber/regenerate — Regenerate a single claim */
  @Post(':claimNumber/regenerate')
  @HttpCode(HttpStatus.OK)
  regenerateClaim(
    @Param('id') projectId: string,
    @Param('claimNumber', ParseIntPipe) claimNumber: number,
  ) {
    return this.service.regenerateClaim(projectId, claimNumber);
  }
}
