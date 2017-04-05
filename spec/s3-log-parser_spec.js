'use strict';

describe("S3LogParser", () => {
  const S3LogParser = require('s3-log-parser');

  describe("#parse", () => {
    var logData;
    var parseLog = () => {
      return S3LogParser.parse(logData);
    };

    beforeEach(() => {
      logData =
          '2017-04-04T23:55:14.676898Z api-cms 54.93.222.213:55494 10.2.120.187:80 0.000024 0.027673 0.000021 200 200 82 78 "GET https://api.scrivito.com:443/tenants/86f1f1e2d836ca377960c1753403d83d/workspaces/published/changes HTTP/1.1" "scrivito_sdk-1.8.1" ECDHE-RSA-AES128-GCM-SHA256 TLSv1.2\n' +
          '2017-04-04T23:55:14.780171Z api-cms 54.77.78.212:34632 oops 0.000022 0.01221 0.000019 200 200 82 81 "GET https://api.scrivito.com:443/tenants/trox/workspaces/published/changes?req=uest&pa=rams HTTP/1.1" "scrivito_sdk-1.4.3" ECDHE-RSA-AES128-GCM-SHA256 TLSv1.2\n' +
          '  2017-04-04T23:55:14.789044Z api-cms    54.147.58.162:48491 10.2.130.135:80 0.000021 0.01036 0.000017 200 200 82 81 "GET https://api.scrivito.com:443/tenants/8e692ce327983776c63ffbd47040a3d8/workspaces/published/changes HTTP/1.1" "scrivito fake \\"1.4\\\\3\\"" ECDHE-RSA-AES128-GCM-SHA256 TLSv1.2\n';
    });

    it("creates a loggly event per log line", () => {
      var result = parseLog();
      expect(Array.isArray(result)).toBeTruthy();
      expect(result.length).toBe(3);

      expect(result[0]).toEqual({
        timestamp: "2017-04-04T23:55:14.676898Z",
        elb: "api-cms",
        client_ip: "54.93.222.213",
        client_port: "55494",
        backend: "10.2.120.187",
        backend_port: "80",
        request_processing_time: 0.000024,
        backend_processing_time: 0.027673,
        response_processing_time: 0.000021,
        elb_status_code: "200",
        backend_status_code: "200",
        received_bytes: 82,
        sent_bytes: 78,
        request_method: "GET",
        request_url: "https://api.scrivito.com:443/tenants/86f1f1e2d836ca377960c1753403d83d/workspaces/published/changes",
        request_query_params: "",
        user_agent: "scrivito_sdk-1.8.1",
        ssl_cipher: "ECDHE-RSA-AES128-GCM-SHA256",
        ssl_protocol: "TLSv1.2",
      });

      expect(result[1]).toEqual({
        timestamp: "2017-04-04T23:55:14.780171Z",
        elb: "api-cms",
        client_ip: "54.77.78.212",
        client_port: "34632",
        backend: "oops",
        backend_port: "-",
        request_processing_time: 0.000022,
        backend_processing_time: 0.01221,
        response_processing_time: 0.000019,
        elb_status_code: "200",
        backend_status_code: "200",
        received_bytes: 82,
        sent_bytes: 81,
        request_method: "GET",
        request_url: "https://api.scrivito.com:443/tenants/trox/workspaces/published/changes",
        request_query_params: "req=uest&pa=rams",
        user_agent: "scrivito_sdk-1.4.3",
        ssl_cipher: "ECDHE-RSA-AES128-GCM-SHA256",
        ssl_protocol: "TLSv1.2",
      });

      expect(result[2]).toEqual({
        timestamp: "2017-04-04T23:55:14.789044Z",
        elb: "api-cms",
        client_ip: "54.147.58.162",
        client_port: "48491",
        backend: "10.2.130.135",
        backend_port: "80",
        request_processing_time: 0.000021,
        backend_processing_time: 0.01036,
        response_processing_time: 0.000017,
        elb_status_code: "200",
        backend_status_code: "200",
        received_bytes: 82,
        sent_bytes: 81,
        request_method: "GET",
        request_url: "https://api.scrivito.com:443/tenants/8e692ce327983776c63ffbd47040a3d8/workspaces/published/changes",
        request_query_params: "",
        user_agent: 'scrivito fake \\"1.4\\\\3\\"',
        ssl_cipher: "ECDHE-RSA-AES128-GCM-SHA256",
        ssl_protocol: "TLSv1.2",
      });
    });
  });
});
