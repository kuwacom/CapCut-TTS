export interface GetTokenResponse {
  ret: string;
  errmsg: string;
  svr_time: number;
  log_id: string;
  data: {
    token: string;
    app_key: string;
  };
}
