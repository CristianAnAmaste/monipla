CREATE TABLE usuarios_sistema (
  id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  nombre NVARCHAR(120) NOT NULL,
  correo NVARCHAR(255) NOT NULL UNIQUE,
  contrasena NVARCHAR(255) NOT NULL,
  activo BIT NOT NULL CONSTRAINT DF_usuarios_sistema_activo DEFAULT 1
);

INSERT INTO usuarios_sistema (nombre, correo, contrasena, activo)
VALUES (
  N'Administrador',
  N'admin@monitoreo.cl',
  N'$2b$12$msqmCUDF0Cpjit.9cOh20e4B59zFiUcW/pMXohcbhCzsH0zq0cQwC',
  1
);
