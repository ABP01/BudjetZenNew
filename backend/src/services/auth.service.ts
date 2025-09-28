import ReportSettingModel, {
  ReportFrequencyEnum,
} from "../models/report-setting.sql";
import UserModel from "../models/user.sql";
import { NotFoundException, UnauthorizedException } from "../utils/app-error";
import { calulateNextReportDate } from "../utils/helper";
import {
  LoginSchemaType,
  RegisterSchemaType,
} from "../validators/auth.validator";

export const registerService = async (body: RegisterSchemaType) => {
  const { email } = body;

  try {
    // Check if user already exists
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) throw new UnauthorizedException("User already exists");

    // Create new user
    const newUser = await UserModel.create({
      name: body.name,
      email: body.email,
      password: body.password,
      profilePicture: body.profilePicture,
    });

    // Create report setting for the user
    await ReportSettingModel.create({
      userId: newUser.userId,
      frequency: ReportFrequencyEnum.MONTHLY,
      isEnabled: true,
      nextReportDate: calulateNextReportDate().toISOString(),
      lastSentDate: undefined,
    });

    return { user: newUser.omitPassword() };
  } catch (error) {
    throw error;
  }
};

export const loginService = async (body: LoginSchemaType) => {
  const { email, password } = body;
  const user = await UserModel.findByEmail(email);
  if (!user) throw new NotFoundException("Email/password not found");

  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid)
    throw new UnauthorizedException("Invalid email/password");

  const reportSetting = await ReportSettingModel.findByUserId(user.userId);

  return {
    user: user.omitPassword(),
    reportSetting,
  };
};
