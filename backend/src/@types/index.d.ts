import { UserDocument } from "../models/user.sql";

declare global {
  namespace Express {
    interface User extends UserDocument {
      _id?: any;
    }
  }
}
