INSERT INTO inspection_type (code, name, description)
SELECT 'RCPCLB', 'ROV CP Calibration', 'ROV Cathodic Protection Calibration'
WHERE NOT EXISTS (SELECT 1 FROM inspection_type WHERE code = 'RCPCLB');

INSERT INTO inspection_type (code, name, description)
SELECT 'RUTCLB', 'ROV UT Calibration', 'ROV Ultrasonic Thickness Calibration'
WHERE NOT EXISTS (SELECT 1 FROM inspection_type WHERE code = 'RUTCLB');
