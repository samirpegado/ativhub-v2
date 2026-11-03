registro de solicitações e informações sobre ativos.

uma etapa importante do sistema vai ser a abertura de solicitações por parte do cliente, mas precisamos de uma forma de autenticar essa abertura para que qq pessoa nao possa fazer.

tbm nao quero criar login e senha para cada cliente, dessa forma eu pensei na seguinte estrutura:

1. remover a criação de um pin geral nas configurações da empresa na rota /company

2. criar um pin por localização. no momento do cadastro de uma localização criar um pin de 4 digitos automaticamente. esse pin poderá ser facilemente editado pelo gestor do sistema.

3. criação de uma pagina 'aberta' para ser acessivel ao scanear o qr code do ativo. ao scanear pedir o pin da localização quando o cliente digitar abrir a pagina que deverá conter:

a. historico de todas as manutenções dos ativos, podendo ser baixada a os/relatorio em pdf
b. um botão para nova solicitação de manutenção.

esses dados devem vir de uma rpc/edge function especifica para isso, visto que praticamente vai ser um autenticação de confiança no pin e no id do ativo.