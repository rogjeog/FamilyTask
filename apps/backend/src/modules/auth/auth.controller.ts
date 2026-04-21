import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser, JwtUser } from './decorators/current-user.decorator';
import { parseTtl } from './utils/tokens.util';

const REFRESH_COOKIE = 'refresh_token';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private buildCookieOptions(expiresInMs?: number) {
    const cookieDomain = this.config.get<string>('COOKIE_DOMAIN') || undefined;
    const isProdLike = !!cookieDomain;
    return {
      httpOnly: true,
      secure: isProdLike,
      sameSite: isProdLike ? ('lax' as const) : ('strict' as const),
      path: '/api/v1/auth',
      ...(cookieDomain && { domain: cookieDomain }),
      ...(expiresInMs !== undefined && { maxAge: expiresInMs }),
    };
  }

  private setRefreshCookie(res: Response, token: string): void {
    const maxAge = parseTtl(
      this.config.get<string>('JWT_REFRESH_TTL') ?? '30d',
    );
    res.cookie(REFRESH_COOKIE, token, this.buildCookieOptions(maxAge));
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, this.buildCookieOptions());
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshTokenPlain } =
      await this.authService.register(dto);
    this.setRefreshCookie(res, refreshTokenPlain);
    return { user, accessToken };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshTokenPlain } =
      await this.authService.login(dto);
    this.setRefreshCookie(res, refreshTokenPlain);
    return { user, accessToken };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = (req.cookies as Record<string, string>)?.[REFRESH_COOKIE];
    if (!token) {
      throw new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN' });
    }
    const { accessToken, refreshTokenPlain } =
      await this.authService.refresh(token);
    this.setRefreshCookie(res, refreshTokenPlain);
    return { accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = (req.cookies as Record<string, string>)?.[REFRESH_COOKIE];
    if (token) {
      await this.authService.logout(token);
    }
    this.clearRefreshCookie(res);
  }

  @Get('me')
  getMe(@CurrentUser() user: JwtUser) {
    return this.authService.getMe(user.userId);
  }
}
