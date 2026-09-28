import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { Permission } from "@gym/database";
import type { Request } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequirePermissions } from "../auth/permissions.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { BillingReasonDto, CapturePaymentDto, ListInvoicesQueryDto } from "./billing.dto";
import { BillingService } from "./billing.service";

@Controller()
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Get("invoices")
  @RequirePermissions(Permission.PAYMENT_READ)
  list(@CurrentUser() principal: AuthPrincipal, @Query() query: ListInvoicesQueryDto) { return this.service.list(principal, query); }

  @Get("invoices/:invoiceId")
  @RequirePermissions(Permission.PAYMENT_READ)
  detail(@CurrentUser() principal: AuthPrincipal, @Param("invoiceId") invoiceId: string) { return this.service.detail(principal, invoiceId); }

  @Post("invoices/:invoiceId/void")
  @RequirePermissions(Permission.PAYMENT_WRITE)
  voidInvoice(@CurrentUser() principal: AuthPrincipal, @Param("invoiceId") invoiceId: string, @Body() dto: BillingReasonDto, @Req() request: Request) { return this.service.voidInvoice(principal, invoiceId, dto, request.ip); }

  @Get("billing/summary")
  @RequirePermissions(Permission.FINANCE_READ)
  summary(@CurrentUser() principal: AuthPrincipal) { return this.service.summary(principal); }

  @Post("payments")
  @RequirePermissions(Permission.PAYMENT_WRITE)
  capturePayment(@CurrentUser() principal: AuthPrincipal, @Body() dto: CapturePaymentDto, @Req() request: Request) { return this.service.capturePayment(principal, dto, request.ip); }

  @Post("payments/:paymentId/reverse")
  @RequirePermissions(Permission.PAYMENT_WRITE)
  reversePayment(@CurrentUser() principal: AuthPrincipal, @Param("paymentId") paymentId: string, @Body() dto: BillingReasonDto, @Req() request: Request) { return this.service.reversePayment(principal, paymentId, dto, request.ip); }
}
