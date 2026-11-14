import type { WorkOrderPrint } from "@/lib/work-orders/print";

export function WorkOrderPrintDocument({ data }: { data: WorkOrderPrint }) {
  const contact = [data.company.phone, data.company.websiteLabel].filter(Boolean);

  return (
    <main className="page">
      <header className="top">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.company.logoUrl ?? "/ativhub_favicon_512.png"} alt="" width={44} height={44} />
          <div>
            <b>{data.company.name}</b>
            {data.company.address ? <span>{data.company.address}</span> : null}
            {contact.length > 0 ? (
              <span>
                {data.company.phone}
                {data.company.phone && data.company.websiteHref ? " · " : null}
                {data.company.websiteHref ? (
                  <a href={data.company.websiteHref}>{data.company.websiteLabel}</a>
                ) : null}
              </span>
            ) : null}
          </div>
        </div>
        <div className="os-id">
          <small>Ordem de serviço</small>
          <strong>{data.code}</strong>
        </div>
      </header>

      <section className="title-block">
        <h1>{data.title}</h1>
        <div className="meta">
          <span className={`tag ${data.statusTone}`}>
            <span className="dot" />
            {data.statusLabel}
          </span>
          <span className={`tag ${data.priorityTone}`}>
            <span className="dot" />
            {data.priorityLabel}
          </span>
          <span className="tag gray">{data.typeLabel}</span>
        </div>
        {data.description ? <p className="lead">{data.description}</p> : null}
        <dl className="facts">
          <div>
            <dt>Vencimento</dt>
            <dd>
              {data.dueDay}
              {data.dueTime ? <small>{data.dueTime}</small> : null}
            </dd>
          </div>
          <div>
            <dt>Tempo registrado</dt>
            <dd>
              {data.laborLabel}
              <small>{data.laborNote}</small>
            </dd>
          </div>
          <div>
            <dt>Tarefas</dt>
            <dd>
              {data.tasksLabel}
              <small>{data.tasksNote}</small>
            </dd>
          </div>
          <div>
            <dt>Peças</dt>
            <dd>
              {data.partsLabel}
              <small>{data.partsNote}</small>
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <div className="cols">
          <div>
            <h2>Cliente</h2>
            {data.customer ? (
              <>
                <p>
                  <b>{data.customer.name}</b>
                  {data.customer.type ? <span className="muted"> · {data.customer.type}</span> : null}
                </p>
                {data.customer.tax ? <p className="muted small">{data.customer.tax}</p> : null}
                {data.customer.phone ? <p>{data.customer.phone}</p> : null}
                {data.customer.email ? <p>{data.customer.email}</p> : null}
                {data.customer.description ? <p className="muted small note">{data.customer.description}</p> : null}
              </>
            ) : (
              <p className="muted">Nenhum cliente.</p>
            )}
          </div>
          <div>
            <h2>Local do serviço</h2>
            {data.location ? (
              <>
                <p>
                  <b>{data.location.name}</b>
                </p>
                {data.location.address ? <p>{data.location.address}</p> : null}
              </>
            ) : (
              <p className="muted">Nenhuma localização.</p>
            )}
          </div>
        </div>
      </section>

      {data.asset ? (
        <section>
          <h2>Ativo atendido</h2>
          <div className="asset-head">
            <b>{data.asset.name}</b>
            {data.asset.code ? <span className="muted">{data.asset.code}</span> : null}
            <span className={`tag small ${data.asset.statusTone}`}>
              <span className="dot" />
              {data.asset.statusLabel}
            </span>
          </div>
          <dl className="grid">
            <div>
              <dt>Categoria</dt>
              <dd>{data.asset.category}</dd>
            </div>
            <div>
              <dt>Fabricante</dt>
              <dd>{data.asset.manufacturer}</dd>
            </div>
            <div>
              <dt>Modelo</dt>
              <dd>{data.asset.model}</dd>
            </div>
            <div>
              <dt>Número de série</dt>
              <dd>{data.asset.serial}</dd>
            </div>
            <div>
              <dt>Código de barras</dt>
              <dd>{data.asset.barcode}</dd>
            </div>
            <div>
              <dt>Potência</dt>
              <dd>{data.asset.power}</dd>
            </div>
            <div>
              <dt>Instalação</dt>
              <dd>{data.asset.area}</dd>
            </div>
            <div>
              <dt>Em serviço desde</dt>
              <dd>{data.asset.inService}</dd>
            </div>
            <div>
              <dt>Fim da garantia</dt>
              <dd>{data.asset.warranty}</dd>
            </div>
            <div>
              <dt>Custo de aquisição</dt>
              <dd className="num">{data.asset.cost}</dd>
            </div>
            {data.asset.description || data.asset.extra ? (
              <div className="span">
                <dt>Descrição</dt>
                <dd>
                  {data.asset.description}
                  {data.asset.description && data.asset.extra ? " " : null}
                  {data.asset.extra ? <span className="muted">{data.asset.extra}</span> : null}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      <section>
        <h2>{data.tasksHeading}</h2>
        <table>
          <thead>
            <tr>
              <th className="task">Tarefa</th>
              <th className="answer">Resposta</th>
              <th>Comentário</th>
              <th className="right when">Data</th>
            </tr>
          </thead>
          <tbody>
            {data.tasks.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  Nenhuma tarefa.
                </td>
              </tr>
            ) : (
              data.tasks.map((task) => (
                <tr key={`${task.label}-${task.day ?? "pendente"}`} className={task.pending ? "pending" : undefined}>
                  <td>
                    {task.label}
                    <span className="type">{task.type}</span>
                  </td>
                  <td className={task.tone ?? undefined}>
                    {task.pending ? <i>{task.answer}</i> : <b>{task.mark ? `${task.mark} ` : ""}{task.answer}</b>}
                  </td>
                  <td className={task.comment === "—" ? "muted" : undefined}>{task.comment}</td>
                  <td className="right small muted num">
                    {task.day ? (
                      <>
                        {task.day}
                        {task.time ? (
                          <>
                            <br />
                            {task.time}
                          </>
                        ) : null}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Mão de obra</h2>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Técnico</th>
              <th>Origem</th>
              <th className="right">Tempo</th>
            </tr>
          </thead>
          {data.labors.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={4} className="muted">
                  Nenhum tempo lançado.
                </td>
              </tr>
            </tbody>
          ) : (
            <>
              <tbody>
                {data.labors.map((labor, index) => (
                  <tr key={`${labor.author}-${labor.day}-${index}`}>
                    <td className="num">{labor.day}</td>
                    <td>{labor.author}</td>
                    <td className="muted">{labor.origin}</td>
                    <td className="right num">{labor.time}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Total registrado</td>
                  <td className="right num">{data.laborTotal}</td>
                </tr>
              </tfoot>
            </>
          )}
        </table>
      </section>

      <section>
        <h2>Peças utilizadas</h2>
        <table>
          <thead>
            <tr>
              <th>Peça</th>
              <th>Quantidade</th>
              <th className="right">Valor</th>
            </tr>
          </thead>
          {data.parts.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={3} className="muted">
                  Nenhuma peça utilizada.
                </td>
              </tr>
            </tbody>
          ) : (
            <>
              <tbody>
                {data.parts.map((part, index) => (
                  <tr key={`${part.name}-${index}`}>
                    <td>{part.name}</td>
                    <td>{part.quantity}</td>
                    <td className="right num">{part.value}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Total em peças</td>
                  <td className="right num">{data.partsTotal}</td>
                </tr>
              </tfoot>
            </>
          )}
        </table>
      </section>

      <section>
        <div className="total">
          <div>
            <span>
              Serviço{data.serviceNote ? <span className="muted small"> {data.serviceNote}</span> : null}
            </span>
            <span className="num">{data.serviceValue}</span>
          </div>
          <div>
            <span>Peças</span>
            <span className="num">{data.partsTotal}</span>
          </div>
          <div className="grand">
            <span>Total</span>
            <span className="num">{data.totalValue}</span>
          </div>
        </div>
      </section>

      {data.images.length > 0 ? (
        <section>
          <h2>Imagens anexas</h2>
          <div className="gallery">
            {data.images.map((image) => (
              <figure key={image.url}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={image.name} />
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      <footer>Documento gerado pelo AtivHub em {data.generatedOn}</footer>
    </main>
  );
}
