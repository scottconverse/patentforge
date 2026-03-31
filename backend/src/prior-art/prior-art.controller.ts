import { Controller, Get, Param, Res, Req } from '@nestjs/common';
import { Response, Request } from 'express';
import { PriorArtService } from './prior-art.service';
import { PriorArtSseService } from './prior-art-sse.service';

@Controller('projects/:id/prior-art')
export class PriorArtController {
  constructor(
    private readonly priorArtService: PriorArtService,
    private readonly sse: PriorArtSseService,
  ) {}

  @Get()
  getLatest(@Param('id') projectId: string) {
    return this.priorArtService.getLatest(projectId);
  }

  @Get('status')
  getStatus(@Param('id') projectId: string) {
    return this.priorArtService.getStatus(projectId);
  }

  @Get('stream')
  stream(@Param('id') projectId: string, @Res() res: Response, @Req() req: Request) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const emitter = this.sse.getOrCreate(projectId);

    const onEvent = (event: any) => {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    };

    emitter.on('event', onEvent);

    req.on('close', () => {
      emitter.off('event', onEvent);
    });
  }
}
