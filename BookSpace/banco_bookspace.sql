-- Execute no banco MySQL criado no provedor. Atualize DB_NAME conforme necessário.
-- CREATE DATABASE bookspace CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE bookspace;

CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  telefone VARCHAR(25) NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS livros (
  id_livro INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(200) NOT NULL,
  autor VARCHAR(150) NOT NULL,
  genero VARCHAR(80) NOT NULL,
  imagem VARCHAR(255) NOT NULL,
  editora VARCHAR(120),
  ano INT,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS alugueis (
  id_aluguel INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT UNSIGNED NOT NULL,
  data_retirada DATE NOT NULL,
  data_devolucao_prevista DATE NOT NULL,
  data_devolucao_real DATE DEFAULT NULL,
  status ENUM('Em andamento', 'Devolvido') NOT NULL DEFAULT 'Em andamento',
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_usuario (id_usuario),
  CONSTRAINT fk_alugueis_usuarios FOREIGN KEY (id_usuario)
    REFERENCES usuarios(id_usuario) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS itens_aluguel (
  id_aluguel INT UNSIGNED NOT NULL,
  id_livro INT UNSIGNED NOT NULL,
  PRIMARY KEY (id_aluguel, id_livro),
  INDEX idx_livro (id_livro),
  CONSTRAINT fk_itens_aluguel FOREIGN KEY (id_aluguel)
    REFERENCES alugueis(id_aluguel) ON DELETE CASCADE,
  CONSTRAINT fk_itens_livro FOREIGN KEY (id_livro)
    REFERENCES livros(id_livro) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO livros (titulo, autor, genero, imagem, editora, ano, descricao, ativo)
SELECT 'É Assim que Acaba', 'Colleen Hoover', 'Romance', 'imagens/livro1.jpg', 'Galera', 2018,
  'Lily acredita que encontrou uma nova chance para ser feliz, mas acontecimentos do passado fazem com que ela precise tomar decisões importantes sobre sua própria vida.', TRUE
WHERE NOT EXISTS (SELECT 1 FROM livros WHERE titulo = 'É Assim que Acaba');

INSERT INTO livros (titulo, autor, genero, imagem, editora, ano, descricao, ativo)
SELECT 'A Biblioteca da Meia-Noite', 'Matt Haig', 'Ficção', 'imagens/livro2.jpg', 'Bertrand Brasil', 2021,
  'Nora encontra uma biblioteca de vidas possíveis e reflete sobre escolhas e arrependimentos.', TRUE
WHERE NOT EXISTS (SELECT 1 FROM livros WHERE titulo = 'A Biblioteca da Meia-Noite');

INSERT INTO livros (titulo, autor, genero, imagem, editora, ano, descricao, ativo)
SELECT 'O Pequeno Príncipe', 'Antoine de Saint-Exupéry', 'Clássico', 'imagens/livro3.webp', 'Diversas edições', 1943,
  'Uma história sobre amizade, afeto e o que é essencial na vida.', TRUE
WHERE NOT EXISTS (SELECT 1 FROM livros WHERE titulo = 'O Pequeno Príncipe');

INSERT INTO livros (titulo, autor, genero, imagem, editora, ano, descricao, ativo)
SELECT 'Harry Potter', 'J. K. Rowling', 'Fantasia', 'imagens/livro4.jpg', 'Rocco', 1997,
  'A jornada de um jovem bruxo em uma escola de magia.', TRUE
WHERE NOT EXISTS (SELECT 1 FROM livros WHERE titulo = 'Harry Potter');
