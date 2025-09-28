import { createSlice } from "@reduxjs/toolkit";

interface AuthState {
  user: User | null;
  reportSetting: ReportSetting | null;
}

interface User {
  id: number;
  name: string;
  email: string;
  profilePicture: string;
}

interface ReportSetting {
  userId: string;
  frequency?: string;
  isEnabled: boolean;
}

const initialState: AuthState = {
  user: null,
  reportSetting: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      state.user = action.payload.user;
      state.reportSetting = action.payload.reportSetting;
    },
    updateCredentials: (state, action) => {
      const { user, reportSetting } = action.payload;

      if (user !== undefined) state.user = { ...state.user, ...user };
      if (reportSetting !== undefined)
        state.reportSetting = { ...state.reportSetting, ...reportSetting };
    },
    logout: (state) => {
      state.user = null;
      state.reportSetting = null;
    },
  },
});

export const { setCredentials, updateCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
