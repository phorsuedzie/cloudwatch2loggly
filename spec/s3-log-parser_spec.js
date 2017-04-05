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

    describe("when log is from ALB", () => {
      beforeEach(() => {
        logData =
            'https 2017-04-04T08:15:14.497261Z app/scrivito-backend-beta/9dce4a619ba727ed 35.158.77.50:47048 10.2.110.21:80 0.000 0.020 0.000 200 200 572 608 "GET https://beta-api.scrivito.com:443/tenants/infopark23444378/workspaces/published/changes HTTP/1.1" "scrivito_sdk-1.9.0.rc1" ECDHE-RSA-AES128-GCM-SHA256 TLSv1.2 arn:aws:elasticloadbalancing:eu-west-1:115379056088:targetgroup/scrivito-backend-beta/5d440ca6b68ffef6 "Root=1-58e35612-51b49fad053f4b773cd44b0e"\n' +
            'h2 2017-04-04T08:15:21.873448Z app/scrivito-backend-beta/9dce4a619ba727ed 95.90.245.243:4083 10.2.120.235:80 0.000 0.026 0.000 401 401 2095 486 "PUT https://beta-api.scrivito.com:443/tenants/scrival/perform HTTP/2.0" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36" ECDHE-RSA-AES128-GCM-SHA256 TLSv1.2 arn:aws:elasticloadbalancing:eu-west-1:115379056088:targetgroup/scrivito-backend-beta/5d440ca6b68ffef6 "Root=1-58e35619-24c373ba3df691fb0dda673a"\n';
      });

      it("creates a loggly event per log line", () => {
        var result = parseLog();
        expect(Array.isArray(result)).toBeTruthy();
        expect(result.length).toBe(2);

        expect(result[0]).toEqual({
          type: "https",
          timestamp: "2017-04-04T08:15:14.497261Z",
          elb: "app/scrivito-backend-beta/9dce4a619ba727ed",
          client_ip: "35.158.77.50",
          client_port: "47048",
          target: "10.2.110.21",
          target_port: "80",
          request_processing_time: 0,
          target_processing_time: 0.02,
          response_processing_time: 0,
          elb_status_code: "200",
          target_status_code: "200",
          received_bytes: 572,
          sent_bytes: 608,
          request_method: "GET",
          request_url: "https://beta-api.scrivito.com:443/tenants/infopark23444378/workspaces/published/changes",
          request_query_params: "",
          user_agent: "scrivito_sdk-1.9.0.rc1",
          ssl_cipher: "ECDHE-RSA-AES128-GCM-SHA256",
          ssl_protocol: "TLSv1.2",
          target_group_arn: "arn:aws:elasticloadbalancing:eu-west-1:115379056088:targetgroup/scrivito-backend-beta/5d440ca6b68ffef6",
          trace_id: "Root=1-58e35612-51b49fad053f4b773cd44b0e",
        });

        expect(result[1]).toEqual({
          type: "h2",
          timestamp: "2017-04-04T08:15:21.873448Z",
          elb: "app/scrivito-backend-beta/9dce4a619ba727ed",
          client_ip: "95.90.245.243",
          client_port: "4083",
          target: "10.2.120.235",
          target_port: "80",
          request_processing_time: 0,
          target_processing_time: 0.026,
          response_processing_time: 0,
          elb_status_code: "401",
          target_status_code: "401",
          received_bytes: 2095,
          sent_bytes: 486,
          request_method: "PUT",
          request_url: "https://beta-api.scrivito.com:443/tenants/scrival/perform",
          request_query_params: "",
          user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36",
          ssl_cipher: "ECDHE-RSA-AES128-GCM-SHA256",
          ssl_protocol: "TLSv1.2",
          target_group_arn: "arn:aws:elasticloadbalancing:eu-west-1:115379056088:targetgroup/scrivito-backend-beta/5d440ca6b68ffef6",
          trace_id: "Root=1-58e35619-24c373ba3df691fb0dda673a",
        });
      });
    });
  });
});
