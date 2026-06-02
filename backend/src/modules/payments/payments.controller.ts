import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * POST /payments/initiate
   * Creates a Flutterwave payment page for a plan upgrade.
   */
  @Post('initiate')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Flutterwave payment link for plan upgrade' })
  @ApiResponse({ status: 200, description: 'Payment URL returned' })
  async initiatePayment(
    @CurrentUser() user: JwtPayload,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.paymentsService.initiatePayment(
      user.tenantId!,
      user.sub,
      dto.plan,
      user.email,
      `${(user as any).firstName ?? ''} ${(user as any).lastName ?? ''}`.trim() || user.email,
    );
  }

  /**
   * GET /payments/verify/:transactionId
   * Verifies a Flutterwave transaction and upgrades the plan.
   * Called from the frontend after the payment redirect.
   */
  @Get('verify/:transactionId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify Flutterwave payment and upgrade tenant plan' })
  @ApiResponse({ status: 200, description: 'Plan upgraded successfully' })
  @ApiResponse({ status: 400, description: 'Payment verification failed' })
  verifyPayment(
    @Param('transactionId') transactionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.paymentsService.verifyAndUpgrade(transactionId, user.tenantId!);
  }

  /**
   * POST /payments/webhook
   * Flutterwave webhook — always returns 200.
   */
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Flutterwave webhook receiver' })
  async webhook(
    @Body() payload: any,
    @Headers('verif-hash') signature: string,
  ) {
    await this.paymentsService.handleWebhook(payload, signature);
    return { status: 'ok' };
  }
}
